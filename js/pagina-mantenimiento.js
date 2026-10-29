/*
 * SIM - Página de mantenimiento (mantenimiento.html)
 */
(function () {
  const C = window.CANARIO;
  const ETIQUETA = { vencida: 'Vencida', proxima: 'Próxima', aldia: 'Al día' };
  const NIVEL = { vencida: 'peligro', proxima: 'precaucion', aldia: 'normal' };

  function frecuencia(dias) {
    if (dias === 1) return 'Diaria';
    if (dias === 7) return 'Semanal';
    if (dias % 365 === 0 || dias === 730) return `Cada ${Math.round(dias / 365)} años`;
    if (dias % 30 === 0) return dias === 30 ? 'Mensual' : `Cada ${dias / 30} meses`;
    return `Cada ${dias} días`;
  }

  function dibujar() {
    const filtro = document.getElementById('f-estado').value;
    const tareas = C.mantenimiento.tareas()
      .map((t) => ({ t, e: C.mantenimiento.estadoDe(t) }))
      .sort((a, b) => a.e.restante - b.e.restante);
    const cuenta = { vencida: 0, proxima: 0, aldia: 0 };
    tareas.forEach((x) => { cuenta[x.e.estado] += 1; });

    document.getElementById('resumen-mant').innerHTML = ['vencida', 'proxima', 'aldia'].map((k) => `
      <div class="resumen-item fila-${NIVEL[k]}"><strong class="cifra">${cuenta[k]}</strong><span>${k === 'vencida' ? 'tareas vencidas' : k === 'proxima' ? 'próximas a vencer' : 'al día'}</span></div>`).join('');

    const visibles = tareas.filter((x) => filtro === 'todas' || (filtro === 'vencida' ? x.e.estado === 'vencida' : x.e.estado !== 'aldia'));
    document.getElementById('tabla-mant').innerHTML = visibles.map(({ t, e }) => `
      <tr class="${e.estado !== 'aldia' ? `fila-${NIVEL[e.estado]}` : ''}">
        <td data-etiqueta="Estado"><span class="pildora nivel-${NIVEL[e.estado]}">${ETIQUETA[e.estado]}</span></td>
        <td data-etiqueta="Actividad"><strong>${C.esc(t.act)}</strong><br><span class="nota">${C.esc(t.fuente)}</span></td>
        <td data-etiqueta="Equipo">${C.esc(t.equipo)}</td>
        <td data-etiqueta="Ubicación">${C.esc(t.ubic)}</td>
        <td data-etiqueta="Frecuencia">${frecuencia(t.cada)}</td>
        <td data-etiqueta="Próxima">${C.mantenimiento.texto(e.restante)}<br><span class="nota">${C.fecha(e.proxima)}</span></td>
        <td data-etiqueta=""><button type="button" class="boton boton-secundario boton-chico" data-hecha="${C.esc(t.id)}">Registrar como hecha</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="nota">No hay tareas con este filtro.</td></tr>';

    const b = C.mantenimiento.bitacora().slice(-8).reverse();
    document.getElementById('bitacora-mant').innerHTML = b.map((x) => `
      <li><strong>${C.esc(x.act)}</strong> <span class="nota">${C.esc(x.equipo)}, ${C.esc(x.ubic)}. ${C.fecha(x.t)} ${C.horaCorta(x.t)}, ${C.esc(x.por)}</span></li>`).join('') ||
      '<li class="nota">Todavía no se ha registrado ningún trabajo en esta sesión.</li>';
  }

  C.alActualizar = dibujar;
  document.getElementById('f-estado').addEventListener('change', dibujar);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hecha]');
    if (!b) return;
    C.mantenimiento.registrar(b.dataset.hecha);
    dibujar();
  });
})();
