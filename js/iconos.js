/*
 * SIM - Íconos y símbolos de minería (SVG en línea, sin archivos externos).
 * Uso en HTML: <span data-icono="casco"></span>  |  En JS: CANARIO.icono('casco', 20)
 */
window.CANARIO = window.CANARIO || {};

(function () {
  const C = window.CANARIO;
  const T = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

  const ICONOS = {
    // Casco minero con lámpara
    casco: T('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M2 16h20v2H2z"/><path d="M12 8V5"/><rect x="10" y="9" width="4" height="3" rx="1"/>'),
    // Pico y martillo cruzados
    pico: T('<path d="M5 19 15 9"/><path d="M11 5c3-2 7-1 9 2-3-1-6 0-8 2"/><path d="M19 19 9 9"/><path d="M5 9l4-4 3 3-4 4z"/>'),
    // Vagoneta
    vagoneta: T('<path d="M3 8h18l-2 8H5z"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/><path d="M7 8l2-3h6l2 3"/>'),
    // Lámpara de casco
    lampara: T('<path d="M9 3h6v6H9z"/><path d="M8 9h8l-1 5H9z"/><path d="M12 14v6"/><path d="M5 5 3 3M19 5l2-2M4 9H2M20 9h2"/>'),
    // Detector de gases
    detector: T('<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="9" y="6" width="6" height="4" rx="1"/><path d="M9 14h6M9 17h6"/>'),
    // Castillete o torre de extracción
    castillete: T('<path d="M6 21 10 7h4l4 14"/><path d="M8 14h8M7 18h10"/><circle cx="12" cy="5" r="2"/>'),
    personas: T('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15 15a5 5 0 0 1 6 5"/>'),
    lista: T('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
    registro: T('<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 12-5"/><path d="M19 14v6M16 17h6"/>'),
    alerta: T('<path d="M12 3 2 20h20z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'),
    historial: T('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 8v5l3 2"/>'),
    llave: T('<path d="M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 1-2-2z"/>'),
    plano: T('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    monitor: T('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="m6 12 3-3 3 2 5-4"/><path d="M8 20h8M12 16v4"/>'),
    salir: T('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>'),
    candado: T('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    check: T('<path d="m5 12 5 5 9-10"/>'),
    sonido: T('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M16 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/>'),
    silencio: T('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>')
  };

  C.icono = (nombre, tam) => {
    const svg = ICONOS[nombre] || '';
    const t = tam || 20;
    return svg.replace('<svg ', `<svg width="${t}" height="${t}" class="icono" `);
  };

  // Logo de SIM: casco con el haz de la lámpara.
  C.logo = (tam) => {
    const t = tam || 36;
    return `<svg width="${t}" height="${t}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="19" fill="#F2C230"/>
      <path d="M9 25a11 11 0 0 1 22 0z" fill="#23272B"/>
      <rect x="7" y="25" width="26" height="3.5" rx="1.5" fill="#23272B"/>
      <rect x="17.5" y="15" width="5" height="4" rx="1" fill="#F2C230"/>
      <path d="M20 15 L14 6 L26 6 Z" fill="#FFFFFF" opacity="0.55"/>
    </svg>`;
  };

  // Figura de persona para la pantalla de roles.
  C.figuraRol = (tipo) => {
    const accesorio = tipo === 'supervisor'
      ? '<rect x="72" y="92" width="26" height="34" rx="3" fill="#FFFFFF" stroke="#23272B" stroke-width="3"/><path d="M78 102h14M78 110h14M78 118h9" stroke="#23272B" stroke-width="2.5"/><rect x="80" y="88" width="10" height="7" rx="2" fill="#23272B"/>'
      : '<rect x="72" y="94" width="24" height="34" rx="4" fill="#23272B"/><rect x="76" y="99" width="16" height="11" rx="2" fill="#7FD3B0"/><circle cx="84" cy="119" r="3" fill="#F2C230"/>';
    const chaleco = tipo === 'supervisor' ? '#F28C28' : '#F2C230';
    return `<svg viewBox="0 0 120 170" width="120" height="170" role="img" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="162" rx="38" ry="6" fill="#00000018"/>
      <path d="M38 160V128h44v32" fill="#3B4248"/>
      <path d="M30 132c0-26 12-40 30-40s30 14 30 40z" fill="${chaleco}"/>
      <path d="M46 96l6 36M74 96l-6 36" stroke="#E4E5E1" stroke-width="4"/>
      <circle cx="60" cy="66" r="20" fill="#E8B48C"/>
      <path d="M38 62a22 22 0 0 1 44 0z" fill="#F2C230"/>
      <rect x="34" y="60" width="52" height="6" rx="3" fill="#D8A817"/>
      <rect x="55" y="46" width="10" height="8" rx="2" fill="#FFFFFF" stroke="#23272B" stroke-width="2"/>
      <circle cx="53" cy="72" r="2.2" fill="#23272B"/><circle cx="67" cy="72" r="2.2" fill="#23272B"/>
      <path d="M54 80q6 4 12 0" stroke="#23272B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      ${accesorio}
    </svg>`;
  };

  function pintar(raiz) {
    (raiz || document).querySelectorAll('[data-icono]').forEach((el) => {
      if (!el.firstChild) el.innerHTML = C.icono(el.dataset.icono, Number(el.dataset.tam) || 20);
    });
  }
  C.pintarIconos = pintar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pintar());
  else pintar();
})();
