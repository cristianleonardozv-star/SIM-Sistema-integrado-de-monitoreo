/*
 * SIM - Roles y encabezado común.
 * Cada página declara en <body> su nombre (data-pagina) y los roles que la pueden ver (data-roles).
 * El rol se elige en index.html, sin contraseña (prototipo).
 */
(function () {
  const C = window.CANARIO;
  const K_ROL = 'sim.rol';

  C.ROLES = {
    supervisor: {
      nombre: 'Supervisor de personal',
      inicio: 'supervisor.html',
      icono: 'personas',
      nav: [
        ['supervisor.html', 'Personal', 'personas', 'personal'],
        ['alerta.html', 'Alertas', 'alerta', 'alertas']
      ]
    },
    ingeniero: {
      nombre: 'Ingeniero de minas',
      inicio: 'ingeniero.html',
      icono: 'casco',
      nav: [
        ['ingeniero.html', 'Monitoreo', 'monitor', 'monitoreo'],
        ['alerta.html', 'Alertas', 'alerta', 'alertas'],
        ['historial.html', 'Historial', 'historial', 'historial'],
        ['mantenimiento.html', 'Mantenimiento', 'llave', 'mantenimiento'],
        ['editor.html', 'Diseñar mina', 'plano', 'editor']
      ]
    }
  };

  C.rol = () => {
    try { return localStorage.getItem(K_ROL); } catch (e) { return null; }
  };
  C.fijarRol = (r) => {
    try { localStorage.setItem(K_ROL, r); } catch (e) { /* nada */ }
  };
  C.inicioRol = () => (C.ROLES[C.rol()] || C.ROLES.ingeniero).inicio;

  function construir() {
    const body = document.body;
    const pagina = body.dataset.pagina;
    const permitidos = (body.dataset.roles || '').split(',').filter(Boolean);
    const rol = C.rol();
    if (permitidos.length && (!rol || !C.ROLES[rol] || !permitidos.includes(rol))) {
      location.replace(rol && C.ROLES[rol] ? C.ROLES[rol].inicio : 'index.html');
      return false;
    }
    const R = C.ROLES[rol];
    const h = document.getElementById('barra');
    if (!h || !R) return true;
    const badge = (id) => {
      if (id === 'alertas') return '<span id="badge-alertas" class="badge" hidden>0</span>';
      if (id === 'mantenimiento') return '<span id="badge-mant" class="badge" hidden>0</span>';
      return '';
    };
    h.innerHTML = `
      <a class="marca" href="${R.inicio}">${C.logo(38)}<span class="marca-texto"><strong>SIM</strong><span>Sistema Integrado de Monitoreo</span></span></a>
      <nav class="nav" aria-label="Secciones">${R.nav.map(([href, txt, ic, id]) =>
        `<a href="${href}"${id === pagina ? ' aria-current="page"' : ''}>${C.icono(ic, 20)}<span class="nav-texto">${txt}</span>${badge(id)}</a>`).join('')}</nav>
      <div class="estado-sistema">
        <div class="dato-hora"><span>Hora</span><strong id="reloj" class="cifra">--:--:--</strong></div>
        <div class="dato-est"><span>Estaciones en línea</span><strong id="estaciones">--</strong></div>
        <button type="button" id="btn-avisos" class="btn-avisos" aria-pressed="false">Silenciar</button>
        <a class="chip-rol" href="index.html" title="Cambiar de rol">${C.icono(R.icono, 18)}<span>${R.nombre}</span></a>
      </div>`;

    const pie = document.createElement('footer');
    pie.className = 'pie';
    pie.innerHTML = `${C.icono('pico', 16)}<span>SIM: Sistema Integrado de Monitoreo. Prototipo para hackatón con datos simulados.</span>`;
    body.appendChild(pie);
    return true;
  }

  C.rolValido = construir();
})();
