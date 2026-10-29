/*
 * SIM - Página del supervisor de personal (supervisor.html)
 * Mineros dentro y su ubicación, control de ingreso con EPP, registro y bloqueo.
 */
(function () {
  const C = window.CANARIO;
  const P = () => C.personal;
  let claveMineros = '';
  let ultimoMinero = '';

  // ---------- Pestañas ----------
  const tabs = ['mina', 'ingreso', 'mineros'];
  function abrir(nombre) {
    tabs.forEach((t) => {
      document.getElementById(`tab-${t}`).setAttribute('aria-selected', t === nombre ? 'true' : 'false');
      document.getElementById(`sec-${t}`).hidden = t !== nombre;
    });
    try { sessionStorage.setItem('sim.tabSupervisor', nombre); } catch (e) { /* nada */ }
  }
  tabs.forEach((t) => document.getElementById(`tab-${t}`).addEventListener('click', () => abrir(t)));
  document.querySelector('.pestanas').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const actual = tabs.findIndex((t) => document.getElementById(`tab-${t}`).getAttribute('aria-selected') === 'true');
    const sig = tabs[(actual + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    abrir(sig);
    document.getElementById(`tab-${sig}`).focus();
  });
  try { const t = sessionStorage.getItem('sim.tabSupervisor'); if (tabs.includes(t)) abrir(t); } catch (e) { /* nada */ }

  const minutos = (t) => Math.max(0, Math.round((Date.now() - t) / 60000));
  const tiempo = (t) => { const m = minutos(t); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

  // ---------- Resumen y banner ----------
  function dibujarResumen(estado) {
    const dentro = P().dentro();
    const enAlerta = dentro.filter((m) => estado.zonas[m.zona] && C.rango(estado.zonas[m.zona].nivel) >= 3).length;
    const evac = dentro.filter((m) => m.evacuando).length;
    const ta = C.turnoActual();
    document.getElementById('turno-actual').textContent = `${C.TURNOS[ta].nombre}, de ${C.TURNOS[ta].horario}. Supervisa quién entra, quién está dentro y dónde.`;
    document.getElementById('resumen-personal').innerHTML = `
      <div class="resumen-item"><strong class="cifra">${dentro.length}</strong><span>personas dentro de la mina</span></div>
      <div class="resumen-item ${enAlerta ? 'fila-peligro' : ''}"><strong class="cifra">${enAlerta}</strong><span>en zonas en Peligro o Evacuación</span></div>
      <div class="resumen-item ${evac ? 'fila-evacuacion' : ''}"><strong class="cifra">${evac}</strong><span>saliendo por evacuación</span></div>
      <div class="resumen-item"><strong class="cifra">${P().mineros().filter((m) => m.bloqueado).length}</strong><span>mineros bloqueados</span></div>`;

    const banner = document.getElementById('banner');
    const graves = C.zonas.filter((z) => C.rango(estado.zonas[z.id].nivel) >= 3);
    if (!graves.length) { banner.hidden = true; return; }
    const peor = graves.sort((a, b) => C.rango(estado.zonas[b.id].nivel) - C.rango(estado.zonas[a.id].nivel))[0];
    const nivel = estado.zonas[peor.id].nivel;
    const n = P().enZona(peor.id).length;
    banner.className = `banner fondo-${nivel}`;
    banner.hidden = false;
    banner.innerHTML = `${C.icono('alerta', 26)}
      <div class="texto"><span class="titulo">${nivel === 'evacuacion' ? `Evacuación en ${C.esc(peor.nombre)}` : `Peligro en ${C.esc(peor.nombre)}`}</span>
      <span>${n ? `${n} personas siguen dentro de la zona` : 'Ya no queda nadie dentro de la zona'}${evac ? ` y ${evac} van saliendo` : ''}. No autorices ingresos a esta zona.</span></div>
      <a class="boton" href="alerta.html">Ver alerta</a>`;
  }

  // ---------- En la mina ----------
  function dibujarMina(estado) {
    C.mapa.actualizar(document.getElementById('mapa'), estado);
    const dentro = P().dentro().slice().sort((a, b) => {
      const na = C.rango(estado.zonas[a.zona] ? estado.zonas[a.zona].nivel : 'normal');
      const nb = C.rango(estado.zonas[b.zona] ? estado.zonas[b.zona].nivel : 'normal');
      return nb - na || a.nombre.localeCompare(b.nombre);
    });
    document.getElementById('lista-dentro').innerHTML = dentro.map((m) => {
      const z = C.zona(m.zona);
      const nivel = estado.zonas[m.zona] ? estado.zonas[m.zona].nivel : 'normal';
      const fueraTurno = Number(m.turno) !== C.turnoActual();
      return `<li class="${nivel !== 'normal' ? `fila-${nivel}` : ''}">
        <span class="avatar-minero" aria-hidden="true">${C.icono('casco', 22)}</span>
        <div class="datos-minero">
          <strong>${C.esc(m.nombre)}</strong>
          <span class="nota">${C.esc(m.codigo)}, ${C.esc(m.cargo)}, cuadrilla ${C.esc(m.cuadrilla)}</span>
          <span>${C.esc(z ? z.nombre : 'Sin zona')}, cerca de la estación ${P().estacionCercana(m)}</span>
          <span class="nota">Dentro hace ${tiempo(m.ingreso)}${fueraTurno ? '. Fuera de su turno' : ''}${m.evacuando ? '. Evacuando' : ''}</span>
        </div>
        <div class="acciones-minero">
          <span class="pildora nivel-${nivel}">${C.niveles[nivel].nombre}</span>
          <button type="button" class="boton boton-secundario boton-chico" data-salida="${C.esc(m.codigo)}">Registrar salida</button>
        </div></li>`;
    }).join('') || '<li class="nota">No hay nadie dentro de la mina. Autoriza ingresos en "Control de ingreso".</li>';
  }

  // ---------- Control de ingreso ----------
  function opcionesMineros() {
    const fuera = P().mineros().filter((m) => !m.dentro).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const clave = fuera.map((m) => `${m.codigo}${m.bloqueado ? 'b' : ''}`).join(',');
    if (clave === claveMineros) return;
    claveMineros = clave;
    const sel = document.getElementById('i-minero');
    const previo = sel.value;
    sel.innerHTML = fuera.length
      ? fuera.map((m) => `<option value="${C.esc(m.codigo)}">${C.esc(m.nombre)} (${C.esc(m.codigo)})${m.bloqueado ? ', bloqueado' : ''}</option>`).join('')
      : '<option value="">Todos los mineros están dentro</option>';
    if (fuera.some((m) => m.codigo === previo)) sel.value = previo;
  }

  function prepararIngreso() {
    document.getElementById('i-zona').innerHTML = C.zonas.map((z) => `<option value="${C.esc(z.id)}">${C.esc(z.nombre)}</option>`).join('');
    document.getElementById('i-epp').innerHTML = C.EPP.map((e) => `
      <label class="opcion-epp"><input type="checkbox" value="${e.id}"><span>${C.esc(e.nombre)}</span></label>`).join('');
    opcionesMineros();
    alCambiarMinero();
    document.getElementById('i-minero').addEventListener('change', alCambiarMinero);
    document.getElementById('i-zona').addEventListener('change', () => evaluar(C.estado()));
    document.getElementById('i-epp').addEventListener('change', () => evaluar(C.estado()));
    document.getElementById('i-todos').addEventListener('click', () => {
      document.querySelectorAll('#i-epp input').forEach((x) => { x.checked = true; });
      evaluar(C.estado());
    });
    document.getElementById('form-ingreso').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = evaluar(C.estado());
      const msg = document.getElementById('i-mensaje');
      if (!r.m) return;
      if (!r.ok) {
        msg.className = 'mensaje-form error';
        msg.textContent = 'No se puede autorizar: revisa los requisitos marcados en rojo.';
        return;
      }
      C.ejecutar(() => P().autorizarIngreso(r.m, r.zona, r.epp));
      msg.className = 'mensaje-form ok';
      msg.textContent = `Ingreso autorizado: ${r.m.nombre} entra a ${C.zona(r.zona).nombre}.`;
      document.querySelectorAll('#i-epp input').forEach((x) => { x.checked = false; });
      claveMineros = '';
      opcionesMineros();
      alCambiarMinero(true);
    });
    document.getElementById('i-rechazar').addEventListener('click', () => {
      const r = evaluar(C.estado());
      if (!r.m) return;
      const motivos = r.lista.filter((x) => !x.ok).map((x) => x.texto);
      P().rechazarIngreso(r.m, motivos.length ? motivos : ['Decisión del supervisor']);
      const msg = document.getElementById('i-mensaje');
      msg.className = 'mensaje-form error';
      msg.textContent = `Se registró que ${r.m.nombre} no fue autorizado para ingresar.`;
      dibujarBitacora();
    });
  }

  function alCambiarMinero(conservarMensaje) {
    const m = P().porCodigo(document.getElementById('i-minero').value);
    if (m && m.codigo !== ultimoMinero) {
      const zc = C.cuadrillas.find((c) => c.codigo === m.cuadrilla);
      if (zc) document.getElementById('i-zona').value = zc.zona;
      ultimoMinero = m.codigo;
    }
    if (conservarMensaje !== true) document.getElementById('i-mensaje').textContent = '';
    evaluar(C.estado ? C.estado() : null);
  }

  function evaluar(estado) {
    const m = P().porCodigo(document.getElementById('i-minero').value);
    const zona = document.getElementById('i-zona').value;
    const epp = [...document.querySelectorAll('#i-epp input:checked')].map((x) => x.value);
    const req = document.getElementById('i-requisitos');
    const boton = document.getElementById('i-autorizar');
    if (!m || !estado) {
      req.innerHTML = '<li class="nota">Elige un minero.</li>';
      boton.disabled = true;
      return { ok: false, lista: [] };
    }
    const lista = P().evaluarIngreso(m, zona, epp, estado);
    const ok = lista.every((x) => x.ok);
    req.innerHTML = lista.map((x) => `<li class="${x.ok ? 'cumple' : 'no-cumple'}">${C.icono(x.ok ? 'check' : 'candado', 18)}<span>${C.esc(x.texto)}</span></li>`).join('');
    boton.disabled = !ok;
    boton.textContent = ok ? 'Autorizar ingreso' : 'Ingreso bloqueado';
    return { ok, lista, m, zona, epp };
  }

  function dibujarBitacora() {
    const icon = { ingreso: 'check', salida: 'salir', rechazo: 'candado', bloqueo: 'candado', permiso: 'check', registro: 'registro', evacuacion: 'alerta' };
    document.getElementById('bitacora').innerHTML = P().bitacora().slice(-10).reverse().map((b) => `
      <li class="mov mov-${b.tipo}">${C.icono(icon[b.tipo] || 'lista', 16)}<span><strong>${C.esc(b.nombre || '')}</strong> ${C.esc(b.texto)} <span class="nota">${C.horaCorta(b.t)}</span></span></li>`).join('') ||
      '<li class="nota">Sin movimientos registrados todavía.</li>';
  }

  // ---------- Mineros registrados ----------
  function prepararRegistro() {
    document.getElementById('r-cargo').innerHTML = C.CARGOS.map((c) => `<option>${C.esc(c)}</option>`).join('');
    document.getElementById('r-cuadrilla').innerHTML = C.cuadrillas.map((c) => `<option value="${C.esc(c.codigo)}">${C.esc(c.codigo)}: ${C.esc(c.nombre)}</option>`).join('');
    document.getElementById('r-turno').innerHTML = [1, 2, 3].map((t) => `<option value="${t}"${t === C.turnoActual() ? ' selected' : ''}>${C.TURNOS[t].nombre} (${C.TURNOS[t].horario})</option>`).join('');
    const form = document.getElementById('form-registro');
    form.addEventListener('input', () => { document.getElementById('r-error').textContent = ''; document.getElementById('r-ok').textContent = ''; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('r-nombre').value.trim();
      const cap = document.getElementById('r-capacitacion').value;
      const med = document.getElementById('r-medico').value;
      const errores = [];
      if (nombre.length < 5) errores.push('Escribe el nombre completo.');
      if (!cap) errores.push('Indica hasta cuándo está vigente la capacitación.');
      if (!med) errores.push('Indica hasta cuándo está vigente el examen médico.');
      if (!C.cuadrillas.length) errores.push('Primero el ingeniero debe crear cuadrillas en el diseño de la mina.');
      if (errores.length) { document.getElementById('r-error').textContent = errores.join(' '); return; }
      const m = P().registrar({
        nombre, cargo: document.getElementById('r-cargo').value, cuadrilla: document.getElementById('r-cuadrilla').value,
        turno: document.getElementById('r-turno').value, capacitacionHasta: cap, medicoHasta: med
      });
      form.reset();
      document.getElementById('r-turno').value = String(C.turnoActual());
      document.getElementById('r-ok').textContent = `${m.nombre} quedó registrado con el código ${m.codigo}.`;
      claveMineros = '';
      opcionesMineros();
      dibujarTabla();
    });
  }

  function dibujarTabla() {
    document.getElementById('tabla-mineros').innerHTML = P().mineros().slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => {
      const cap = C.vigente(m.capacitacionHasta);
      const estado = m.bloqueado ? '<span class="pildora nivel-peligro">Bloqueado</span>' : (m.dentro ? '<span class="pildora nivel-dentro">Dentro</span>' : '<span class="pildora nivel-normal">Fuera</span>');
      return `<tr class="${m.bloqueado ? 'fila-peligro' : ''}">
        <td data-etiqueta="Minero"><strong>${C.esc(m.nombre)}</strong><br><span class="nota">${C.esc(m.codigo)}</span>${m.bloqueado && m.motivoBloqueo ? `<br><span class="nota">Motivo: ${C.esc(m.motivoBloqueo)}</span>` : ''}</td>
        <td data-etiqueta="Cargo">${C.esc(m.cargo)}</td>
        <td data-etiqueta="Cuadrilla">${C.esc(m.cuadrilla)}</td>
        <td data-etiqueta="Turno">${C.TURNOS[m.turno] ? C.TURNOS[m.turno].nombre : m.turno}</td>
        <td data-etiqueta="Capacitación">${cap ? `Vigente hasta ${C.esc(m.capacitacionHasta)}` : `<span class="texto-peligro">Vencida (${C.esc(m.capacitacionHasta)})</span>`}</td>
        <td data-etiqueta="Estado">${estado}</td>
        <td data-etiqueta="">${m.bloqueado
          ? `<button type="button" class="boton boton-secundario boton-chico" data-permitir="${C.esc(m.codigo)}">Permitir ingreso</button>`
          : `<button type="button" class="boton boton-peligro boton-chico" data-bloquear="${C.esc(m.codigo)}">Bloquear ingreso</button>`}</td></tr>`;
    }).join('');
  }

  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-salida]');
    if (s) {
      const m = P().porCodigo(s.dataset.salida);
      if (m) C.ejecutar(() => P().registrarSalida(m, 'Salida registrada por el supervisor'));
      claveMineros = '';
      return;
    }
    const b = e.target.closest('[data-bloquear]');
    if (b) {
      const m = P().porCodigo(b.dataset.bloquear);
      const motivo = m && prompt(`Motivo para bloquear el ingreso de ${m.nombre}:`, 'No cumple con la capacitación requerida');
      if (m && motivo && motivo.trim()) { P().bloquear(m, motivo.trim()); claveMineros = ''; C.alActualizar(C.estado()); }
      return;
    }
    const p = e.target.closest('[data-permitir]');
    if (p) {
      const m = P().porCodigo(p.dataset.permitir);
      if (m) { P().permitir(m); claveMineros = ''; C.alActualizar(C.estado()); }
    }
  });

  let preparado = false;
  C.alActualizar = function (estado) {
    if (!preparado) { prepararIngreso(); prepararRegistro(); preparado = true; }
    dibujarResumen(estado);
    dibujarMina(estado);
    opcionesMineros();
    evaluar(estado);
    dibujarBitacora();
    dibujarTabla();
  };
})();
