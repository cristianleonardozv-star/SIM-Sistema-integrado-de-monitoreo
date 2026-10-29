/*
 * Canario Digital - Simulador de sensores (datos inyectados)
 * Genera lecturas realistas cada 5 s para las zonas de la mina diseñada
 * y permite provocar escenarios de riesgo en cualquier zona.
 */
(function () {
  const C = window.CANARIO;
  const VARS = ['ch4', 'o2', 'co', 'co2', 'h2s', 'polvo', 'temp', 'hum', 'pres'];
  const RUIDO = { ch4: 0.012, o2: 0.04, co: 0.8, co2: 0.01, h2s: 0.03, polvo: 0.06, temp: 0.1, hum: 0.6, pres: 0.12 };
  const DECIMALES = { ch4: 3, o2: 2, co: 1, co2: 3, h2s: 2, polvo: 2, temp: 2, hum: 1, pres: 1 };

  // Escenarios para la demo. "meta" es el valor al que llega la variable.
  C.escenarios = {
    metano: { nombre: 'Subir metano', cambios: [{ v: 'ch4', meta: 1.15, paso: 0.045 }] },
    polvo: { nombre: 'Subir polvo', cambios: [{ v: 'polvo', meta: 3.6, paso: 0.15 }] },
    oxigeno: { nombre: 'Bajar oxígeno', cambios: [{ v: 'o2', meta: 18.4, paso: 0.15 }] },
    incendio: { nombre: 'Posible incendio', cambios: [{ v: 'temp', meta: 33.5, paso: 0.4 }, { v: 'co', meta: 67, paso: 4 }] },
    falla: { nombre: 'Dejar sin datos una estación', falla: true },
    presion: { nombre: 'Caída de presión en toda la mina', global: true, cambios: [{ v: 'pres', delta: -3, paso: 0.25 }] }
  };

  const ruido = (a) => (Math.random() * 2 - 1) * a;
  const redondear = (v, k) => {
    const f = Math.pow(10, DECIMALES[k]);
    return Math.round(v * f) / f;
  };
  const clave = (id, zona) => (C.escenarios[id] && C.escenarios[id].global ? `${id}@todas` : `${id}@${zona}`);

  function lectura(zona, deriva) {
    const out = {};
    VARS.forEach((k) => {
      let v = zona.base[k] + ((deriva && deriva[k]) || 0) + ruido(RUIDO[k]);
      if (k !== 'temp' && k !== 'pres') v = Math.max(0, v);
      out[k] = redondear(v, k);
    });
    return out;
  }

  // Eventos de días anteriores, ubicados en zonas del tipo adecuado si existen.
  function eventosPrevios(ahora) {
    const m = 60000;
    const d = 24 * 60 * m;
    const deTipo = (tipo) => C.zonas.find((z) => z.tipo === tipo);
    const lista = [];
    const tambor = deTipo('tambor');
    if (tambor) lista.push({
      id: 'ev-previo-1', zona: tambor.id, inicio: ahora - 62 * m, fin: ahora - 47 * m,
      nivelMax: 'precaucion', nivelActual: 'normal', causa: 'Metano en 0,58 %',
      requiereConfirmacion: false, inicioAlerta: null, confirmada: false, escalada: false,
      accion: 'Ventilación aumentada por el PLC', nota: null,
      timeline: [
        { t: ahora - 62 * m, nivel: 'precaucion', texto: 'Precaución: Metano en 0,51 %' },
        { t: ahora - 62 * m, nivel: 'precaucion', texto: 'PLC: ventilador al 70 %, baliza amarilla, ingreso permitido' },
        { t: ahora - 47 * m, nivel: 'normal', texto: 'Evento cerrado tras lecturas estables (histéresis)' }
      ]
    });
    const frente = deTipo('frente');
    if (frente) lista.push({
      id: 'ev-previo-2', zona: frente.id, inicio: ahora - d - 180 * m, fin: ahora - d - 139 * m,
      nivelMax: 'precaucion', nivelActual: 'normal', causa: 'Polvo en suspensión al 78 % del límite',
      requiereConfirmacion: false, inicioAlerta: null, confirmada: false, escalada: false,
      accion: 'Humectación del frente', nota: null,
      timeline: [
        { t: ahora - d - 180 * m, nivel: 'precaucion', texto: 'Precaución: Polvo en suspensión en 2,3 mg/m³' },
        { t: ahora - d - 139 * m, nivel: 'normal', texto: 'Evento cerrado tras lecturas estables (histéresis)' }
      ]
    });
    const galeria = C.zonas.filter((z) => z.tipo === 'galeria').pop();
    if (galeria) lista.push({
      id: 'ev-previo-3', zona: galeria.id, inicio: ahora - 4 * d, fin: ahora - 4 * d + 15 * m,
      nivelMax: 'peligro', nivelActual: 'normal', causa: 'Oxígeno en 19,2 %',
      requiereConfirmacion: true, inicioAlerta: ahora - 4 * d, confirmada: true, escalada: true,
      confirmadoPor: 'Jefe de seguridad', confirmadoEn: ahora - 4 * d + 3 * m,
      accion: 'Retiro de personal y revisión de ventilación', nota: null,
      timeline: [
        { t: ahora - 4 * d, nivel: 'peligro', texto: 'Peligro: Oxígeno en 19,2 %' },
        { t: ahora - 4 * d, nivel: 'peligro', texto: 'PLC: ventilador al 100 %, baliza roja intermitente, ingreso bloqueado' },
        { t: ahora - 4 * d + 2 * m, nivel: 'peligro', texto: 'Sin confirmación en 2 min: escalada al jefe de seguridad' },
        { t: ahora - 4 * d + 3 * m, nivel: 'peligro', texto: 'Confirmada por el jefe de seguridad: retiro de personal' },
        { t: ahora - 4 * d + 15 * m, nivel: 'normal', texto: 'Evento cerrado tras lecturas estables (histéresis)' }
      ]
    });
    return lista;
  }

  C.simulador = {
    VARS,
    clave,

    estadoInicial() {
      const ahora = Date.now();
      const zonas = {};
      C.zonas.forEach((z) => {
        zonas[z.id] = {
          lecturas: lectura(z, null), t: ahora, deriva: {},
          estacionesEnLinea: z.estaciones, nivel: 'normal', causas: [],
          textoCorto: '', plc: C.motor.plc('normal'), ticksNormal: 0, fallaDesde: null
        };
      });
      const cuadrillas = C.cuadrillas.map((c) => ({
        ...c, personasActuales: c.personas, bateria: 88 + Math.round(Math.random() * 10),
        lectura: null, ultimoDato: ahora
      }));
      return {
        version: 2, minaRev: C.mina.revision, zonas, cuadrillas,
        escenarios: {}, eventos: eventosPrevios(ahora), ultimoTick: 0
      };
    },

    // Historial inyectado: las últimas 2 horas, una lectura por minuto.
    generarSemilla() {
      const h = [];
      const ahora = Date.now();
      const tambor = C.zonas.find((z) => z.tipo === 'tambor');
      for (let i = C.config.minutosSemilla; i > 0; i--) {
        const t = ahora - i * 60000;
        C.zonas.forEach((z) => {
          const deriva = {};
          if (tambor && z.id === tambor.id && i <= 62 && i >= 47) {
            deriva.ch4 = 0.22 * (1 - Math.abs(i - 55) / 9);
          }
          const v = lectura(z, deriva);
          h.push({ t, z: z.id, v, n: C.motor.nivelLecturas(v) });
        });
      }
      return h;
    },

    activo(estado, id, zona) {
      return !!estado.escenarios[clave(id, zona)];
    },

    // Activa o desactiva un escenario en una zona. "normalizar" los apaga todos.
    alternar(estado, id, zona) {
      if (id === 'normalizar') {
        estado.escenarios = {};
        estado.cuadrillas.forEach((c) => { c.personasActuales = c.personas; });
        return;
      }
      const k = clave(id, zona);
      if (estado.escenarios[k]) delete estado.escenarios[k];
      else estado.escenarios[k] = Date.now();
    },

    descripcion(k) {
      const [id, zona] = k.split('@');
      const e = C.escenarios[id];
      if (!e) return k;
      if (e.global) return e.nombre;
      const z = C.zona(zona);
      return `${e.nombre} en ${z ? z.nombre : zona}`;
    },

    // Nueva lectura de todas las zonas y detectores.
    tick(estado, ahora) {
      const objetivos = {};
      Object.keys(estado.escenarios).forEach((k) => {
        const [id, zonaEsc] = k.split('@');
        const e = C.escenarios[id];
        if (!e || !e.cambios) return;
        const zonas = e.global ? C.zonas : C.zonas.filter((z) => z.id === zonaEsc);
        zonas.forEach((z) => {
          e.cambios.forEach((c) => {
            const objetivo = c.meta != null ? c.meta - z.base[c.v] : c.delta;
            objetivos[z.id] = objetivos[z.id] || {};
            const previo = objetivos[z.id][c.v];
            if (!previo || Math.abs(objetivo) > Math.abs(previo.obj)) objetivos[z.id][c.v] = { obj: objetivo, paso: c.paso };
          });
        });
      });

      C.zonas.forEach((z) => {
        const ez = estado.zonas[z.id];
        VARS.forEach((k) => {
          const actual = ez.deriva[k] || 0;
          const o = objetivos[z.id] && objetivos[z.id][k];
          let nuevo;
          if (o) {
            const dif = o.obj - actual;
            nuevo = Math.abs(dif) <= o.paso ? o.obj : actual + Math.sign(dif) * o.paso;
          } else {
            nuevo = Math.abs(actual) < 0.002 ? 0 : actual * 0.7;
          }
          ez.deriva[k] = nuevo;
        });

        if (estado.escenarios[`falla@${z.id}`]) {
          if (!ez.fallaDesde) ez.fallaDesde = ahora;
          ez.estacionesEnLinea = z.estaciones - 1;
        } else {
          ez.fallaDesde = null;
          ez.estacionesEnLinea = z.estaciones;
        }

        ez.lecturas = lectura(z, ez.deriva);
        ez.t = ahora;
      });

      // Detector de cada cuadrilla: mide cerca de su zona.
      estado.cuadrillas.forEach((c) => {
        const v = estado.zonas[c.zona].lecturas;
        c.lectura = {
          ch4: redondear(Math.max(0, v.ch4 + ruido(0.03)), 'ch4'),
          o2: redondear(v.o2 + ruido(0.05), 'o2'),
          co: redondear(Math.max(0, v.co + ruido(1)), 'co'),
          h2s: redondear(Math.max(0, v.h2s + ruido(0.03)), 'h2s')
        };
        c.nivelDetector = C.motor.nivelLecturas({ ...v, ...c.lectura });
        c.ultimoDato = ahora;
        c.bateria = Math.max(15, Math.round((c.bateria - 0.02) * 100) / 100);
      });

      estado.ultimoTick = ahora;
    }
  };
})();
