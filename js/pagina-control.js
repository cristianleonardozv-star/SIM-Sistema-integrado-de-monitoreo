/*
 * SIM (Sistema Integrado de Monitoreo) - Página de monitoreo del ingeniero (ingeniero.html)
 */
(function () {
  const C = window.CANARIO;
  let seleccionManual = null;

  function zonaMasGrave(estado) {
    let peor = C.zonas[0].id;
    C.zonas.forEach((z) => {
      if (C.rango(estado.zonas[z.id].nivel) > C.rango(estado.zonas[peor].nivel)) peor = z.id;
    });
    return peor;
  }

  function personasEn(estado, zonaId) {
    return C.personal.enZona(zonaId).length;
  }

  // ---------- Banner de la alerta más grave ----------
  function dibujarBanner(estado) {
    const el = document.getElementById('banner');
    const abiertas = estado.eventos
      .filter((e) => !e.fin && e.requiereConfirmacion)
      .sort((a, b) => C.rango(b.nivelActual) - C.rango(a.nivelActual) || a.inicio - b.inicio);
    if (!abiertas.length) { el.hidden = true; return; }
    const ev = abiertas[0];
    const z = C.zona(ev.zona);
    const nivel = ev.nivelActual === 'normal' ? ev.nivelMax : ev.nivelActual;
    const plc = estado.zonas[z.id].plc;
    let estadoConf;
    if (ev.confirmada) estadoConf = `Confirmada: ${C.esc(ev.accion)}`;
    else if (ev.escalada) estadoConf = 'Escalada al jefe de seguridad, sin confirmar';
    else {
      const resta = Math.max(0, C.config.escalamientoMs - (Date.now() - ev.inicioAlerta));
      const m = Math.floor(resta / 60000);
      const s = String(Math.floor((resta % 60000) / 1000)).padStart(2, '0');
      estadoConf = `Se escala al jefe de seguridad en <span class="cuenta">${m}:${s}</span>`;
    }
    const otras = abiertas.length > 1 ? ` Hay ${abiertas.length - 1} alerta(s) más abiertas.` : '';
    el.className = `banner fondo-${nivel}`;
    el.hidden = false;
    el.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>
      <div class="texto">
        <span class="titulo">${nivel === 'evacuacion' ? `Evacuar ${C.esc(z.nombre)} ahora: ${C.esc(ev.causa.toLowerCase())}` : `${C.niveles[nivel].nombre}: ${C.esc(ev.causa.toLowerCase())} en ${C.esc(z.nombre)}`}</span>
        <span>Ventilador al ${plc.ventilador} %, ingreso ${plc.ingreso.toLowerCase()}, energía ${plc.energia.toLowerCase()}. Hay ${personasEn(estado, z.id)} personas en la zona.${otras}</span>
      </div>
      <span>${estadoConf}</span>
      <a class="boton" href="alerta.html?id=${encodeURIComponent(ev.id)}">${ev.confirmada ? 'Ver alerta' : 'Revisar y confirmar'}</a>`;
  }

  // ---------- Mapa ----------
  function dibujarMapa(estado) {
    C.mapa.actualizar(document.getElementById('mapa'), estado);
  }

  // ---------- Detalle de la zona ----------
  function chispa(historial, zonaId) {
    const desde = Date.now() - 30 * 60000;
    const puntos = historial.filter((h) => h.z === zonaId && h.t >= desde);
    if (puntos.length < 2) return '';
    const W = 340, H = 64, max = 1.2;
    const t0 = puntos[0].t, t1 = puntos[puntos.length - 1].t || t0 + 1;
    const x = (t) => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = (v) => H - (Math.min(v, max) / max) * H;
    const linea = puntos.map((p) => `${x(p.t).toFixed(1)},${y(p.v.ch4).toFixed(1)}`).join(' ');
    const ult = puntos[puntos.length - 1];
    const n = C.motor.nivelVariable('ch4', ult.v.ch4);
    return `<svg class="chispa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Metano en los últimos 30 minutos, valor actual ${C.conUnidad('ch4', ult.v.ch4)}">
      <rect x="0" y="0" width="${W}" height="${y(1.0)}" fill="#E9CDD0"/>
      <rect x="0" y="${y(1.0)}" width="${W}" height="${y(0.8) - y(1.0)}" fill="#F7D9D5"/>
      <rect x="0" y="${y(0.8)}" width="${W}" height="${y(0.5) - y(0.8)}" fill="#FBEFC4"/>
      <polyline points="${linea}" fill="none" stroke="#23272B" stroke-width="2"/>
      <circle cx="${x(ult.t).toFixed(1)}" cy="${y(ult.v.ch4).toFixed(1)}" r="3.5" fill="${n === 'normal' ? '#23272B' : C.colores[n]}"/>
    </svg>`;
  }

  function contexto(k, v, estado, zonaId) {
    const L = C.limites[k];
    if (k === 'o2') return 'Rango 19,5 a 23,5';
    if (k === 'temp') return `Humedad ${C.conUnidad('hum', estado.zonas[zonaId].lecturas.hum)}`;
    if (k === 'pres') {
      const ant = C.motor.lecturaAnterior(C.historial(), zonaId, Date.now(), 10);
      if (!ant) return 'Sin tendencia aún';
      const d = v - ant.v.pres;
      if (Math.abs(d) < 0.5) return 'Estable en 10 min';
      return `${d >= 0 ? 'Subió' : 'Bajó'} ${Math.abs(d).toLocaleString('es-CO', { maximumFractionDigits: 1 })} hPa en 10 min`;
    }
    if (L && L.limite) return `${Math.round((v / L.limite) * 100)} % del límite`;
    return '';
  }

  function dibujarDetalle(estado, historial, zonaId) {
    const z = C.zona(zonaId);
    const ez = estado.zonas[zonaId];
    document.getElementById('det-nombre').textContent = z.nombre;
    const pill = document.getElementById('det-nivel');
    pill.className = `pildora grande nivel-${ez.nivel}`;
    pill.textContent = C.niveles[ez.nivel].nombre;

    const ch4 = document.getElementById('det-ch4');
    const nch4 = C.motor.nivelVariable('ch4', ez.lecturas.ch4);
    ch4.textContent = C.conUnidad('ch4', ez.lecturas.ch4);
    ch4.style.color = nch4 === 'normal' ? '#1F2328' : C.coloresTexto[nch4];
    document.getElementById('det-chispa').innerHTML = chispa(historial, zonaId);

    const causas = document.getElementById('det-causas');
    const textos = ez.causas.filter((c) => c.texto).map((c) => c.texto);
    if (ez.nivel !== 'normal') {
      const f = C.simulador.focoDe(estado, zonaId);
      textos.unshift(`Detectado por la estación ${C.codigoEstacion(zonaId, f)}, a unos ${Math.round((f + 0.5) * 30)} m del inicio del tramo (titila en el mapa)`);
    }
    causas.hidden = !textos.length;
    causas.className = `causas fila-${ez.nivel}`;
    causas.textContent = textos.join('. ') + (textos.length ? '.' : '');
    const mant = document.getElementById('det-mant');
    const vencidas = C.mantenimiento ? C.mantenimiento.deZona(zonaId) : [];
    mant.hidden = !vencidas.length;
    mant.innerHTML = vencidas.length ? `Mantenimiento vencido en esta zona: ${vencidas.map((t) => C.esc(t.act.toLowerCase())).join(', ')}. <a href="mantenimiento.html">Ver mantenimiento</a>` : '';

    const filas = ['o2', 'co', 'co2', 'h2s', 'polvo', 'temp', 'pres'].map((k) => {
      const v = ez.lecturas[k];
      const n = C.limites[k] ? C.motor.nivelVariable(k, v) : 'normal';
      return `<tr class="${n !== 'normal' ? `fila-${n}` : ''}">
        <th scope="row">${C.meta(k).nombre}</th>
        <td class="valor">${C.conUnidad(k, v)}</td>
        <td class="ctx">${contexto(k, v, estado, zonaId)}</td></tr>`;
    });
    document.getElementById('det-variables').innerHTML = filas.join('');

    const p = ez.plc;
    const alerta = C.rango(ez.nivel) >= 2;
    document.getElementById('det-plc').innerHTML = `
      <li class="${ez.nivel !== 'normal' ? 'alerta' : ''}"><span>Ventilador</span><strong>Al ${p.ventilador} %</strong></li>
      <li class="${alerta ? 'alerta' : ''}"><span>Baliza y sirena</span><strong>${p.baliza}; sirena ${p.sirena.toLowerCase()}</strong></li>
      <li class="${alerta ? 'alerta' : ''}"><span>Ingreso a la zona</span><strong>${p.ingreso}</strong></li>
      <li class="${p.energia === 'Cortada' ? 'alerta' : ''}"><span>Energía de la zona</span><strong>${p.energia === 'Cortada' ? 'Cortada' : 'Conectada; se corta en 1,0 %'}</strong></li>`;

    const c = estado.cuadrillas.find((q) => q.zona === zonaId);
    const cq = document.getElementById('det-cuadrilla');
    if (c && c.lectura) {
      const hace = Math.round((Date.now() - c.ultimoDato) / 1000);
      cq.innerHTML = `
        <div><strong>${C.esc(c.nombre)}, detector ${C.esc(c.codigo)}</strong><span style="color:#575C61">${personasEn(estado, zonaId)} personas en la zona. CH₄ en el detector: ${C.conUnidad('ch4', c.lectura.ch4)}</span></div>
        <div class="der"><span>Último dato hace ${hace} s</span><span style="color:#575C61">Batería ${Math.round(c.bateria)} %</span></div>`;
    } else {
      cq.innerHTML = '<div><strong>Sin cuadrilla en esta zona</strong><span style="color:#575C61">El ingreso se autoriza solo si la zona está en Normal o Precaución.</span></div>';
    }
  }

  // ---------- Tabla de zonas ----------
  function dibujarTabla(estado, zonaId) {
    const orden = C.zonas.slice().sort((a, b) => C.rango(estado.zonas[b.id].nivel) - C.rango(estado.zonas[a.id].nivel));
    document.getElementById('tabla-zonas').innerHTML = orden.map((z) => {
      const ez = estado.zonas[z.id];
      const v = ez.lecturas;
      const n = ez.nivel;
      return `<tr class="${n !== 'normal' ? `fila-${n}` : ''}">
        <th scope="row"><button type="button" class="btn-zona" data-zona="${z.id}" aria-pressed="${z.id === zonaId}">${C.esc(z.nombre)}</button></th>
        <td data-etiqueta="Nivel"><span class="pildora nivel-${n}">${C.niveles[n].nombre}</span></td>
        <td data-etiqueta="CH₄" class="num ${C.motor.nivelVariable('ch4', v.ch4) !== 'normal' ? 'fuerte' : ''}">${C.conUnidad('ch4', v.ch4)}</td>
        <td data-etiqueta="O₂" class="num ${C.motor.nivelVariable('o2', v.o2) !== 'normal' ? 'fuerte' : ''}">${C.conUnidad('o2', v.o2)}</td>
        <td data-etiqueta="CO" class="num ${C.motor.nivelVariable('co', v.co) !== 'normal' ? 'fuerte' : ''}">${C.conUnidad('co', v.co)}</td>
        <td data-etiqueta="Polvo" class="num ${C.motor.nivelVariable('polvo', v.polvo) !== 'normal' ? 'fuerte' : ''}">${C.conUnidad('polvo', v.polvo)}</td>
        <td data-etiqueta="Estaciones" class="num ${ez.estacionesEnLinea < z.estaciones ? 'fuerte' : ''}">${ez.estacionesEnLinea} de ${z.estaciones}</td>
        <td data-etiqueta="Personas" class="num">${personasEn(estado, z.id)}</td></tr>`;
    }).join('');
  }

  // ---------- Panel de simulación ----------
  let zonaSim = null;
  function dibujarSimulacion(estado) {
    const sel = document.getElementById('sim-zona');
    if (!sel.options.length) {
      sel.innerHTML = C.zonas.map((z) => `<option value="${C.esc(z.id)}">${C.esc(z.nombre)}</option>`).join('');
      const frente = C.zonas.find((z) => z.tipo === 'frente');
      zonaSim = frente ? frente.id : C.zonas[0].id;
      sel.value = zonaSim;
      sel.addEventListener('change', () => { zonaSim = sel.value; dibujarSimulacion(C.estado()); });
    }
    const cont = document.getElementById('botones-sim');
    if (!cont.children.length) {
      cont.innerHTML = Object.keys(C.escenarios).map((id) => `<button type="button" class="boton boton-secundario" data-escenario="${id}" aria-pressed="false">${C.escenarios[id].nombre}</button>`).join('') +
        '<button type="button" class="boton boton-principal" data-escenario="normalizar">Normalizar todo</button>';
    }
    cont.querySelectorAll('[data-escenario]').forEach((b) => {
      if (b.dataset.escenario !== 'normalizar') b.setAttribute('aria-pressed', C.simulador.activo(estado, b.dataset.escenario, zonaSim) ? 'true' : 'false');
    });
    const activos = Object.keys(estado.escenarios).map((k) => C.simulador.descripcion(k));
    document.getElementById('sim-activos').textContent = activos.length ? `Escenarios activos: ${activos.join('; ')}.` : 'No hay escenarios activos.';
  }

  C.alActualizar = function (estado, historial) {
    const zonaId = seleccionManual || zonaMasGrave(estado);
    dibujarBanner(estado);
    dibujarMapa(estado);
    dibujarDetalle(estado, historial, zonaId);
    dibujarTabla(estado, zonaId);
    dibujarSimulacion(estado);
  };

  document.addEventListener('click', (e) => {
    const bz = e.target.closest('.btn-zona');
    if (bz) {
      seleccionManual = seleccionManual === bz.dataset.zona ? null : bz.dataset.zona;
      C.alActualizar(C.estado(), C.historial());
      return;
    }
    const be = e.target.closest('[data-escenario]');
    if (be) C.ejecutar((estado) => C.simulador.alternar(estado, be.dataset.escenario, zonaSim));
  });

  // La cuenta regresiva del banner se actualiza cada segundo.
  setInterval(() => { if (C.estado) dibujarBanner(C.estado()); }, 1000);
})();
