/*
 * SIM (Sistema Integrado de Monitoreo) - Motor de alertas y lógica del PLC
 * Valida, compara con los límites, decide el nivel de cada zona,
 * calcula las acciones del PLC y gestiona los eventos y alertas.
 */
(function () {
  const C = window.CANARIO;
  const R = (n) => C.rango(n);
  const mayor = (a, b) => (R(a) >= R(b) ? a : b);
  const subir = (n) => ({
    normal: 'precaucion', precaucion: 'peligro', falla: 'peligro',
    peligro: 'evacuacion', evacuacion: 'evacuacion'
  }[n]);

  // Nivel de una variable frente a su límite.
  function nivelVariable(k, v) {
    const L = C.limites[k];
    if (!L || v == null || isNaN(v)) return 'normal';
    if (k === 'ch4') {
      if (v >= L.evacuacion) return 'evacuacion';
      if (v >= L.peligro) return 'peligro';
      if (v >= L.precaucion) return 'precaucion';
      return 'normal';
    }
    if (k === 'o2') {
      if (v < L.evacuacionMin || v > L.max) return 'evacuacion';
      if (v < L.min) return 'peligro';
      if (v < L.precaucionMin) return 'precaucion';
      return 'normal';
    }
    if (k === 'temp') {
      if (v >= L.peligro) return 'peligro';
      if (v >= L.precaucion) return 'precaucion';
      return 'normal';
    }
    const r = v / L.limite;
    if (r >= 2) return 'evacuacion';
    if (r >= 1) return 'peligro';
    if (r >= 0.5) return 'precaucion';
    return 'normal';
  }

  // Valida que la lectura sea físicamente posible.
  function lecturaValida(v) {
    if (!v) return false;
    return v.o2 >= 0 && v.o2 <= 100 && v.ch4 >= 0 && v.ch4 <= 100 && v.co >= 0;
  }

  // Nivel de un conjunto de lecturas, con reglas combinadas.
  function evaluarLecturas(v) {
    const causas = [];
    let nivel = 'normal';
    Object.keys(C.limites).forEach((k) => {
      const n = nivelVariable(k, v[k]);
      if (n !== 'normal') causas.push({ v: k, nivel: n });
      nivel = mayor(nivel, n);
    });
    const nv = (k) => R(nivelVariable(k, v[k]));
    if (nv('polvo') >= 1 && nv('ch4') >= 1) {
      nivel = subir(nivel);
      causas.push({ v: 'combinada', nivel, texto: 'Polvo y metano altos a la vez: más riesgo de explosión' });
    }
    if (nv('temp') >= 1 && nv('co') >= 1) {
      nivel = subir(nivel);
      causas.push({ v: 'combinada', nivel, texto: 'Temperatura y CO subiendo juntos: posible incendio' });
    }
    return { nivel, causas };
  }

  function nivelLecturas(v) {
    return evaluarLecturas(v).nivel;
  }

  // Acciones del PLC según el nivel de la zona.
  function plc(nivel) {
    return {
      ventilador: { normal: 40, precaucion: 70, falla: 100, peligro: 100, evacuacion: 100 }[nivel],
      baliza: { normal: 'Verde', precaucion: 'Amarilla', falla: 'Azul, estado seguro', peligro: 'Roja intermitente', evacuacion: 'Roja rápida' }[nivel],
      sirena: { normal: 'Apagada', precaucion: 'Pitido corto', falla: 'Doble tono', peligro: 'Intermitente', evacuacion: 'Continua' }[nivel],
      ingreso: R(nivel) >= 2 ? 'Bloqueado' : 'Permitido',
      energia: nivel === 'evacuacion' ? 'Cortada' : 'Conectada'
    };
  }

  function textoPLC(nivel) {
    const p = plc(nivel);
    let t = `PLC: ventilador al ${p.ventilador} %, baliza ${p.baliza.toLowerCase()}, ingreso ${p.ingreso.toLowerCase()}`;
    if (nivel === 'evacuacion') t += ', energía de la zona cortada';
    return t;
  }

  // Texto de la causa más grave.
  function textoCausa(causas, lecturas) {
    if (!causas.length) return 'Sin causa';
    const peor = causas.slice().sort((a, b) => R(b.nivel) - R(a.nivel))[0];
    if (peor.texto) return peor.texto;
    return `${C.meta(peor.v).nombre} en ${C.conUnidad(peor.v, lecturas[peor.v])}`;
  }

  function textoCorto(causas, lecturas) {
    if (!causas.length) return '';
    const peor = causas.slice().sort((a, b) => R(b.nivel) - R(a.nivel))[0];
    if (peor.v === 'falla') return 'Estación sin datos';
    if (peor.v === 'pres') return 'Caída de presión';
    if (peor.v === 'combinada') {
      const vars = causas.filter((c) => C.limites[c.v]).map((c) => C.meta(c.v).corto);
      return vars.length ? `${vars.join(' y ')} altos` : 'Regla combinada';
    }
    return `${C.meta(peor.v).corto} ${C.conUnidad(peor.v, lecturas[peor.v])}`;
  }

  // Lectura de la misma zona hace ~10 minutos (para la tendencia de presión).
  function lecturaAnterior(historial, zonaId, ahora, minutos) {
    const limite = ahora - minutos * 60000;
    for (let i = historial.length - 1; i >= 0; i--) {
      const h = historial[i];
      if (h.z === zonaId && h.t <= limite) return h;
    }
    return null;
  }

  function eventoAbierto(estado, zonaId) {
    return estado.eventos.find((e) => e.zona === zonaId && !e.fin);
  }

  function nuevoEvento(estado, z, nivel, causas, lecturas, ahora) {
    const ev = {
      id: `ev-${ahora.toString(36)}-${z.id}`,
      zona: z.id,
      inicio: ahora,
      fin: null,
      nivelMax: nivel,
      nivelActual: nivel,
      causa: textoCausa(causas, lecturas),
      requiereConfirmacion: R(nivel) >= 2,
      inicioAlerta: R(nivel) >= 2 ? ahora : null,
      confirmada: false,
      escalada: false,
      accion: null,
      nota: null,
      timeline: [
        { t: ahora, nivel, texto: `${C.niveles[nivel].nombre}: ${textoCausa(causas, lecturas)}` },
        { t: ahora, nivel, texto: textoPLC(nivel) }
      ]
    };
    estado.eventos.push(ev);
    if (estado.eventos.length > 200) estado.eventos.splice(0, estado.eventos.length - 200);
    return ev;
  }

  function aviso(ev, z, nivel) {
    return {
      eventoId: ev.id,
      nivel,
      titulo: `${C.niveles[nivel].nombre} en ${z.nombre}`,
      cuerpo: `${ev.causa}. ${textoPLC(nivel)}.`,
      sonido: true,
      notificar: R(nivel) >= 1
    };
  }

  // Ciclo principal del motor. Devuelve los avisos que hay que emitir.
  function evaluar(estado, historial, ahora) {
    const avisos = [];

    C.zonas.forEach((z) => {
      const ez = estado.zonas[z.id];
      let nivel = 'normal';
      let causas = [];

      if (lecturaValida(ez.lecturas)) {
        const r = evaluarLecturas(ez.lecturas);
        nivel = r.nivel;
        causas = r.causas;
      } else {
        nivel = 'falla';
        causas = [{ v: 'falla', nivel: 'falla', texto: 'Lectura inválida del sensor' }];
      }

      // Caída sostenida de presión: más salida de gas probable.
      const ant = lecturaAnterior(historial, z.id, ahora, 10);
      if (ant && ant.v.pres - ez.lecturas.pres >= 1.5) {
        causas.push({ v: 'pres', nivel: 'precaucion', texto: 'Caída de presión atmosférica: puede aumentar la salida de gas' });
        nivel = mayor(nivel, 'precaucion');
      }

      // Estación sin datos por más de 30 s.
      if (ez.fallaDesde && ahora - ez.fallaDesde >= C.config.sinDatosMs) {
        causas.push({ v: 'falla', nivel: 'falla', texto: 'Una estación sin datos desde hace más de 30 s' });
        nivel = mayor(nivel, 'falla');
      }

      ez.causas = causas;
      ez.textoCorto = textoCorto(causas, ez.lecturas);
      ez.plc = plc(nivel);

      let ev = eventoAbierto(estado, z.id);
      if (nivel !== 'normal') {
        ez.ticksNormal = 0;
        if (!ev) {
          ev = nuevoEvento(estado, z, nivel, causas, ez.lecturas, ahora);
          avisos.push(aviso(ev, z, nivel));
        } else if (R(nivel) > R(ev.nivelMax)) {
          ev.nivelMax = nivel;
          ev.causa = textoCausa(causas, ez.lecturas);
          ev.timeline.push({ t: ahora, nivel, texto: `Sube a ${C.niveles[nivel].nombre}: ${ev.causa}` });
          ev.timeline.push({ t: ahora, nivel, texto: textoPLC(nivel) });
          if (R(nivel) >= 2 && !ev.requiereConfirmacion) {
            ev.requiereConfirmacion = true;
            ev.inicioAlerta = ahora;
          }
          avisos.push(aviso(ev, z, nivel));
        } else if (nivel !== ev.nivelActual) {
          ev.timeline.push({ t: ahora, nivel, texto: `Baja a ${C.niveles[nivel].nombre}` });
        }
        ev.nivelActual = nivel;
      } else if (ev) {
        ez.ticksNormal = (ez.ticksNormal || 0) + 1;
        if (ev.nivelActual !== 'normal') {
          ev.timeline.push({ t: ahora, nivel: 'normal', texto: 'Valores de nuevo en rango normal' });
          ev.nivelActual = 'normal';
        }
        if (ez.ticksNormal >= C.config.ticksHisteresis) {
          ev.fin = ahora;
          ev.timeline.push({ t: ahora, nivel: 'normal', texto: 'Evento cerrado tras lecturas estables (histéresis)' });
          avisos.push({
            eventoId: ev.id, nivel: 'normal',
            titulo: `${z.nombre}: zona normalizada`,
            cuerpo: `El evento de ${ev.causa.toLowerCase()} se cerró.`,
            sonido: false, notificar: R(ev.nivelMax) >= 1
          });
        }
      }
      ez.nivel = nivel;

      // La salida de las personas en Evacuación la maneja js/personal.js.

      historial.push({ t: ahora, z: z.id, v: ez.lecturas, n: nivel });
    });

    // Escalamiento si nadie confirma en 2 minutos.
    estado.eventos.forEach((ev) => {
      if (!ev.fin && ev.requiereConfirmacion && !ev.confirmada && !ev.escalada &&
          ahora - ev.inicioAlerta >= C.config.escalamientoMs) {
        ev.escalada = true;
        ev.timeline.push({ t: ahora, nivel: ev.nivelActual, texto: 'Sin confirmación en 2 min: escalada al jefe de seguridad' });
        const z = C.zona(ev.zona);
        avisos.push({
          eventoId: ev.id, nivel: ev.nivelActual,
          titulo: 'Alerta escalada al jefe de seguridad',
          cuerpo: `${z.nombre}: ${ev.causa}. Nadie confirmó la alerta en 2 minutos.`,
          sonido: true, notificar: true
        });
      }
    });

    return avisos;
  }

  C.motor = { nivelVariable, nivelLecturas, evaluarLecturas, plc, textoPLC, evaluar, lecturaAnterior };
})();
