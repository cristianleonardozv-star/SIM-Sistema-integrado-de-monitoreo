/*
 * Canario Digital - Página de alertas (alerta.html)
 * Línea de tiempo del evento, personas en la zona y confirmación.
 */
(function () {
  const C = window.CANARIO;
  let seleccion = new URLSearchParams(location.search).get('id');
  let formularioDe = null; // evita borrar lo que el supervisor está escribiendo

  const ACCIONES = [
    'Evacuar la cuadrilla de la zona',
    'Mantener ventilación al máximo y vigilar',
    'Cortar la energía de la zona ahora',
    'Enviar a mantenimiento a revisar el equipo'
  ];

  function abiertas(estado) {
    return estado.eventos
      .filter((e) => !e.fin && e.requiereConfirmacion)
      .sort((a, b) => C.rango(b.nivelActual) - C.rango(a.nivelActual) || a.inicio - b.inicio);
  }

  function eventoActual(estado) {
    const lista = abiertas(estado);
    let ev = seleccion && estado.eventos.find((e) => e.id === seleccion);
    if (!ev) ev = lista[0] || null;
    return ev;
  }

  function nivelVisible(ev) {
    return ev.nivelActual === 'normal' ? ev.nivelMax : ev.nivelActual;
  }

  function textoCuenta(ev) {
    if (ev.fin) return { rotulo: 'Evento cerrado', valor: C.horaCorta(ev.fin) };
    if (ev.confirmada) return { rotulo: 'Confirmada a las', valor: C.horaCorta(ev.confirmadoEn) };
    if (ev.escalada) return { rotulo: 'Escalada al', valor: 'Jefe de seguridad' };
    const resta = Math.max(0, C.config.escalamientoMs - (Date.now() - ev.inicioAlerta));
    const m = Math.floor(resta / 60000);
    const s = String(Math.floor((resta % 60000) / 1000)).padStart(2, '0');
    return { rotulo: 'Escala al jefe de seguridad en', valor: `${m}:${s}` };
  }

  function explicacion(ev, estado) {
    const ez = estado.zonas[ev.zona];
    if (ev.fin) return 'Los valores volvieron a la normalidad y el evento se cerró.';
    if (ev.nivelActual === 'normal') return 'Los valores ya están en rango normal. El evento se cierra cuando se mantengan estables.';
    if (ev.nivelActual === 'evacuacion') return 'El PLC cortó la energía de la zona y ordenó evacuar. La sirena local suena de forma continua.';
    if (ev.nivelActual === 'falla') return 'La zona pasó a estado seguro: ventilación al máximo e ingreso bloqueado hasta revisar el equipo.';
    if (ev.nivelActual === 'peligro') {
      const ch4 = ez.lecturas.ch4;
      if (ch4 >= 0.8) return 'Si el metano llega a 1,0 %, el PLC corta la energía de la zona y ordena evacuar.';
      return 'El PLC subió la ventilación al máximo y bloqueó el ingreso a la zona.';
    }
    return 'El PLC aumentó la ventilación.';
  }

  function dibujarCabecera(estado, ev) {
    const el = document.getElementById('cabecera-alerta');
    const z = C.zona(ev.zona);
    const n = nivelVisible(ev);
    const cuenta = textoCuenta(ev);
    el.innerHTML = `
      <div class="cabecera-alerta fondo-${n}">
        <div class="texto">
          <span>${C.niveles[ev.nivelMax].nombre} desde las ${C.hora(ev.inicio)} en ${C.esc(z.nombre)}</span>
          <h1>${C.esc(ev.causa)}</h1>
          <span>${explicacion(ev, estado)}</span>
        </div>
        <div class="reloj-alerta"><span>${cuenta.rotulo}</span><strong id="cuenta">${cuenta.valor}</strong></div>
      </div>`;
  }

  function dibujarLineaTiempo(ev) {
    const pasos = ev.timeline.slice();
    if (!ev.fin && !ev.confirmada) pasos.push({ t: null, nivel: 'pendiente', texto: 'Esperando confirmación del supervisor' });
    document.getElementById('linea-tiempo').innerHTML = pasos.map((p) => {
      const color = p.nivel === 'pendiente' ? '#F4F4F1' : C.colores[p.nivel];
      const borde = p.nivel === 'pendiente' ? 'border:2px solid #23272B;' : '';
      return `<li><span class="punto" style="background:${color};${borde}"></span>
        <span class="t">${p.t ? C.hora(p.t) : 'Ahora'}</span><span>${C.esc(p.texto)}</span></li>`;
    }).join('');
  }

  function dibujarPersonas(estado, ev) {
    const cuadrillas = estado.cuadrillas.filter((c) => c.zona === ev.zona);
    const total = cuadrillas.reduce((s, c) => s + c.personasActuales, 0);
    const el = document.getElementById('personas');
    if (!cuadrillas.length) {
      el.innerHTML = '<div style="display:flex;align-items:baseline;gap:10px"><span class="cifra-grande">0</span><span class="nota">No hay cuadrillas asignadas a esta zona.</span></div>';
      return;
    }
    const c = cuadrillas[0];
    el.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:10px">
        <span class="cifra-grande">${total}</span>
        <span class="nota">${C.esc(c.nombre)}, detector ${C.esc(c.codigo)}${total === 0 ? '. Todas las personas salieron de la zona.' : ''}</span>
      </div>
      <dl class="datos">
        <div><dt>Lectura del detector</dt><dd>CH₄ ${C.conUnidad('ch4', c.lectura ? c.lectura.ch4 : 0)}</dd></div>
        <div><dt>Aviso en el detector</dt><dd>${C.rango(c.nivelDetector) >= 1 ? 'Vibración y pitido activos' : 'Sin aviso'}</dd></div>
        <div><dt>Batería del detector</dt><dd>${Math.round(c.bateria)} %</dd></div>
        <div><dt>Ruta de salida</dt><dd>Galería principal a bocamina</dd></div>
      </dl>`;
  }

  function dibujarFormulario(ev) {
    const cont = document.getElementById('zona-formulario');
    const clave = `${ev.id}|${ev.confirmada}|${!!ev.fin}`;
    if (formularioDe === clave) return;
    formularioDe = clave;

    if (ev.confirmada) {
      cont.innerHTML = `
        <dl class="datos" style="grid-template-columns:minmax(0,1fr)">
          <div><dt>Confirmó</dt><dd>${C.esc(ev.confirmadoPor)} a las ${C.hora(ev.confirmadoEn)}</dd></div>
          <div><dt>Acción ordenada</dt><dd>${C.esc(ev.accion)}</dd></div>
          ${ev.nota ? `<div><dt>Nota</dt><dd>${C.esc(ev.nota)}</dd></div>` : ''}
        </dl>
        <p class="nota">La alerta sigue visible hasta que la zona vuelva a Normal y se mantenga estable.</p>`;
      return;
    }
    if (ev.fin) {
      cont.innerHTML = '<p class="nota">Este evento se cerró sin confirmación. Queda registrado así en el historial.</p>';
      return;
    }
    cont.innerHTML = `
      <p class="nota" style="font-size:14px">La sirena de superficie se silencia al confirmar. La alerta sigue abierta hasta que los valores se normalicen.</p>
      <form id="form-confirmar" novalidate style="display:flex;flex-direction:column;gap:14px">
        <fieldset>
          <legend>Acción ordenada</legend>
          ${ACCIONES.map((a, i) => `<label class="opcion"><input type="radio" name="accion" value="${C.esc(a)}"${i === 0 && ev.nivelActual === 'evacuacion' ? ' checked' : ''}><span>${C.esc(a)}</span></label>`).join('')}
        </fieldset>
        <p id="error-accion" class="error" role="alert"></p>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label for="nota" style="font-weight:700">Nota para el registro (opcional)</label>
          <textarea id="nota" rows="3" placeholder="Por ejemplo: se ordenó la salida por radio al jefe de frente."></textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button type="submit" class="boton boton-principal" style="flex:1 1 200px">Confirmar y registrar</button>
          <button type="button" id="btn-escalar" class="boton boton-secundario"${ev.escalada ? ' disabled' : ''}>Escalar ahora</button>
        </div>
      </form>`;

    const form = document.getElementById('form-confirmar');
    form.addEventListener('change', () => { document.getElementById('error-accion').textContent = ''; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const elegida = form.querySelector('input[name="accion"]:checked');
      if (!elegida) {
        document.getElementById('error-accion').textContent = 'Elige la acción que ordenaste antes de confirmar.';
        return;
      }
      const nota = document.getElementById('nota').value.trim();
      const id = ev.id;
      C.ejecutar((estado) => {
        const e2 = estado.eventos.find((x) => x.id === id);
        if (!e2) return;
        const ahora = Date.now();
        e2.confirmada = true;
        e2.confirmadoPor = 'Supervisor de turno';
        e2.confirmadoEn = ahora;
        e2.accion = elegida.value;
        e2.nota = nota || null;
        e2.timeline.push({ t: ahora, nivel: e2.nivelActual, texto: `Confirmada por el supervisor de turno: ${elegida.value.toLowerCase()}` });
      });
    });
    document.getElementById('btn-escalar').addEventListener('click', () => {
      const id = ev.id;
      document.getElementById('btn-escalar').disabled = true;
      C.ejecutar((estado) => {
        const e2 = estado.eventos.find((x) => x.id === id);
        if (!e2 || e2.escalada) return;
        e2.escalada = true;
        e2.timeline.push({ t: Date.now(), nivel: e2.nivelActual, texto: 'Escalada manualmente al jefe de seguridad' });
      });
    });
  }

  function dibujarLista(estado, ev) {
    const lista = abiertas(estado);
    const el = document.getElementById('lista-alertas');
    if (!lista.length) {
      el.innerHTML = '<li class="nota">No hay otras alertas abiertas.</li>';
      return;
    }
    el.innerHTML = lista.map((e) => {
      const n = nivelVisible(e);
      return `<li><a href="alerta.html?id=${encodeURIComponent(e.id)}" data-id="${e.id}" aria-current="${ev && e.id === ev.id}">
        <span><span class="pildora nivel-${n}">${C.niveles[n].nombre}</span> ${e.confirmada ? '<span class="nota">Confirmada</span>' : ''}</span>
        <strong>${C.esc(C.zona(e.zona).nombre)}</strong>
        <span class="nota">${C.esc(e.causa)}, desde las ${C.horaCorta(e.inicio)}</span></a></li>`;
    }).join('');
  }

  function dibujarVacio() {
    document.getElementById('cabecera-alerta').innerHTML = `
      <section class="panel vacio">
        <h1>No hay alertas abiertas</h1>
        <p class="nota" style="font-size:15px">Todas las zonas están en Normal o Precaución. Para la demostración, provoca un evento desde el panel de simulación de la sala de control.</p>
        <a class="boton boton-principal" href="index.html">Ir a la sala de control</a>
      </section>`;
    document.getElementById('cuerpo-alerta').hidden = true;
    document.getElementById('panel-confirmar').hidden = true;
    formularioDe = null;
  }

  C.alActualizar = function (estado) {
    const ev = eventoActual(estado);
    dibujarLista(estado, ev);
    if (!ev) { dibujarVacio(); return; }
    document.getElementById('cuerpo-alerta').hidden = false;
    document.getElementById('panel-confirmar').hidden = false;
    dibujarCabecera(estado, ev);
    dibujarLineaTiempo(ev);
    dibujarPersonas(estado, ev);
    dibujarFormulario(ev);
  };

  // Cambiar de alerta sin recargar la página.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.lista-alertas a[data-id]');
    if (!a) return;
    e.preventDefault();
    seleccion = a.dataset.id;
    history.replaceState(null, '', `alerta.html?id=${encodeURIComponent(seleccion)}`);
    C.alActualizar(C.estado());
  });

  // Cuenta regresiva cada segundo.
  setInterval(() => {
    if (!C.estado) return;
    const ev = eventoActual(C.estado());
    const el = document.getElementById('cuenta');
    if (ev && el) el.textContent = textoCuenta(ev).valor;
  }, 1000);
})();
