/*
 * Canario Digital - Dibujo del corte de la mina a partir del diseño.
 * Lo usan la sala de control (index.html) y el editor (editor.html).
 */
(function () {
  const C = window.CANARIO;
  const ANCHO = 900;
  const ALTO = 490;

  function punto(t, f) {
    return { x: t.x1 + (t.x2 - t.x1) * f, y: t.y1 + (t.y2 - t.y1) * f };
  }

  // Normal hacia arriba (o hacia la izquierda si el tramo es vertical).
  function normalArriba(t) {
    const L = Math.hypot(t.x2 - t.x1, t.y2 - t.y1) || 1;
    let nx = -(t.y2 - t.y1) / L;
    let ny = (t.x2 - t.x1) / L;
    if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx > 0)) { nx = -nx; ny = -ny; }
    return { nx, ny };
  }

  function posEtiqueta(t) {
    const mx = (t.x1 + t.x2) / 2;
    const my = (t.y1 + t.y2) / 2;
    const minx = Math.min(t.x1, t.x2), maxx = Math.max(t.x1, t.x2);
    const miny = Math.min(t.y1, t.y2), maxy = Math.max(t.y1, t.y2);
    switch (t.etiqueta) {
      case 'arriba': return { x: mx, y: miny - 38, a: 'middle' };
      case 'derecha': return { x: maxx + 20, y: my - 4, a: 'start' };
      case 'izquierda': return { x: minx - 20, y: my - 4, a: 'end' };
      default:
        // Si no cabe abajo (cerca de la leyenda), va arriba.
        if (maxy + 50 > 455) return { x: mx, y: miny - 38, a: 'middle' };
        return { x: mx, y: maxy + 34, a: 'middle' };
    }
  }

  function f1(n) { return Math.round(n * 10) / 10; }

  function contenido(mina, op) {
    op = op || {};
    const e = C.esc;
    const p = [];
    p.push('<rect x="0" y="0" width="900" height="60" fill="#DDE0DA"/>');
    if (op.rejilla) {
      p.push('<defs><pattern id="rejilla" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#D3D6D1" stroke-width="0.6"/></pattern></defs>');
      p.push(`<rect x="0" y="60" width="${ANCHO}" height="${ALTO - 60}" fill="url(#rejilla)"/>`);
    }
    p.push('<path d="M0 60h900" stroke="#575C61" stroke-width="1.5"/>');
    p.push('<text x="16" y="36" font-size="13" fill="#575C61">Superficie</text>');
    p.push('<rect x="120" y="18" width="128" height="30" rx="3" fill="#23272B"/>');
    p.push('<text x="184" y="38" font-size="12" fill="#F4F4F1" text-anchor="middle">Sala de control</text>');
    p.push('<path d="M184 48V60" stroke="#23272B" stroke-width="1.5" stroke-dasharray="5 5"/>');

    // Tramos (cada uno es una zona).
    mina.tramos.forEach((t) => {
      const sel = op.seleccion && op.seleccion.tipo === 'tramo' && op.seleccion.id === t.id;
      p.push(`<path class="tramo${sel ? ' seleccionado' : ''}" data-zona="${e(t.id)}" d="M${t.x1} ${t.y1} L${t.x2} ${t.y2}" stroke="#A9AEA9"/>`);
    });
    // Fibra óptica a lo largo de cada tramo.
    mina.tramos.forEach((t) => {
      p.push(`<path class="fibra" d="M${t.x1} ${t.y1} L${t.x2} ${t.y2}" fill="none" stroke="#23272B" stroke-width="1.5" stroke-dasharray="5 5"/>`);
    });
    // Estaciones fijas cada 30 m.
    p.push('<g class="estaciones" stroke-width="1.5">');
    mina.tramos.forEach((t) => {
      const n = C.estacionesDe(t, mina.escala);
      const largoPx = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
      const visibles = Math.max(1, Math.min(n, Math.floor(largoPx / 12)));
      for (let i = 0; i < visibles; i++) {
        const q = punto(t, (i + 0.5) / visibles);
        p.push(`<rect data-zona="${e(t.id)}" x="${f1(q.x - 5)}" y="${f1(q.y - 5)}" width="10" height="10" fill="#F4F4F1" stroke="#23272B"/>`);
      }
      const ult = punto(t, (visibles - 0.5) / visibles);
      p.push(`<g id="falla-${e(t.id)}" class="marca-falla" style="display:none"><rect x="${f1(ult.x - 10)}" y="${f1(ult.y - 10)}" width="20" height="20" fill="#4B4FB8"/><path d="M${f1(ult.x - 4)} ${f1(ult.y - 4)}l8 8M${f1(ult.x + 4)} ${f1(ult.y - 4)}l-8 8" stroke="#FFFFFF" stroke-width="2"/></g>`);
    });
    p.push('</g>');

    // Etiquetas.
    mina.tramos.forEach((t) => {
      const q = posEtiqueta(t);
      p.push(`<text id="lbl-${e(t.id)}" x="${f1(q.x)}" y="${f1(q.y)}" text-anchor="${q.a}" font-size="13" font-weight="600" fill="#23272B">${e(t.nombre)}</text>`);
      p.push(`<text id="val-${e(t.id)}" x="${f1(q.x)}" y="${f1(q.y + 16)}" text-anchor="${q.a}" font-size="12" fill="#575C61"></text>`);
    });

    // Cuadrillas con su detector.
    mina.cuadrillas.forEach((c) => {
      const t = mina.tramos.find((x) => x.id === c.zona);
      if (!t) return;
      const q = punto(t, c.pos == null ? 0.5 : c.pos);
      const n = normalArriba(t);
      const x = q.x + n.nx * 32, y = q.y + n.ny * 32;
      const sel = op.seleccion && op.seleccion.tipo === 'cuadrilla' && op.seleccion.id === c.id;
      p.push(`<g id="cq-${e(c.id)}" class="marca-cuadrilla${sel ? ' seleccionada' : ''}" data-cuadrilla="${e(c.id)}">
        <line x1="${f1(q.x)}" y1="${f1(q.y)}" x2="${f1(x)}" y2="${f1(y)}" stroke="#23272B" stroke-width="1"/>
        <circle cx="${f1(x)}" cy="${f1(y)}" r="15" fill="#F4F4F1" stroke="#23272B" stroke-width="1.5"/>
        <text x="${f1(x)}" y="${f1(y + 4)}" font-size="12" font-weight="600" fill="#23272B" text-anchor="middle">${e(c.codigo)}</text>
        <title>${e(c.nombre)}</title></g>`);
    });

    // Asas para mover los extremos del tramo seleccionado (solo en el editor).
    if (op.editor && op.seleccion && op.seleccion.tipo === 'tramo') {
      const t = mina.tramos.find((x) => x.id === op.seleccion.id);
      if (t) {
        p.push(`<circle class="asa" data-asa="1" cx="${t.x1}" cy="${t.y1}" r="9"/>`);
        p.push(`<circle class="asa" data-asa="2" cx="${t.x2}" cy="${t.y2}" r="9"/>`);
      }
    }

    if (op.vistaPrevia) {
      const v = op.vistaPrevia;
      p.push(`<path d="M${v.x1} ${v.y1} L${v.x2} ${v.y2}" stroke="#1F6FEB" stroke-width="22" stroke-linecap="round" opacity="0.35"/>`);
      p.push(`<text x="${v.x2 + 14}" y="${v.y2 - 12}" font-size="12" fill="#1F4FA0">${Math.round(C.longitud(v, mina.escala))} m</text>`);
    }

    // Leyenda.
    p.push(`<g font-size="12" fill="#575C61">
      <rect x="16" y="466" width="10" height="10" fill="#F4F4F1" stroke="#23272B" stroke-width="1.5"/><text x="32" y="475">Estación fija, cada 30 m</text>
      <circle cx="208" cy="471" r="7" fill="#F4F4F1" stroke="#23272B" stroke-width="1.5"/><text x="222" y="475">Cuadrilla con detector</text>
      <path d="M370 471h28" stroke="#23272B" stroke-width="1.5" stroke-dasharray="5 5"/><text x="406" y="475">Fibra óptica a superficie</text>
    </g>`);
    return p.join('');
  }

  C.mapa = { ANCHO, ALTO, punto, normalArriba, contenido };
})();
