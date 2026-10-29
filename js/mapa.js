/*
 * SIM (Sistema Integrado de Monitoreo) - Dibujo del corte de la mina a partir del diseño.
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
    p.push('<text x="884" y="36" font-size="13" fill="#575C61" text-anchor="end">Superficie</text>');
    p.push('<rect x="120" y="18" width="128" height="30" rx="3" fill="#23272B"/>');
    p.push('<text x="184" y="38" font-size="12" fill="#F4F4F1" text-anchor="middle">Sala de control</text>');
    p.push('<path d="M184 48V60" stroke="#23272B" stroke-width="1.5" stroke-dasharray="5 5"/>');

    // Castillete y vagoneta en la entrada de la bocamina.
    const boca = mina.tramos.find((t) => t.tipo === 'bocamina' && Math.min(t.y1, t.y2) <= 64);
    if (boca) {
      const bx = boca.y1 <= boca.y2 ? boca.x1 : boca.x2;
      p.push(`<g class="castillete" stroke="#575C61" stroke-width="2" fill="none" aria-hidden="true">
        <path d="M${bx - 16} 60 L${bx - 4} 20 M${bx + 16} 60 L${bx + 4} 20 M${bx - 12} 46 H${bx + 12} M${bx - 8} 33 H${bx + 8}"/>
        <circle cx="${bx}" cy="17" r="6"/><path d="M${bx} 17 L${bx + 26} 50"/>
      </g>`);
      const vx = 262;
      if (bx < 236 || bx > 320) {
        p.push(`<g aria-hidden="true"><path d="M${vx} 44 h26 l-3 9 h-20 z" fill="#575C61"/><circle cx="${vx + 7}" cy="56" r="2.6" fill="#23272B"/><circle cx="${vx + 19}" cy="56" r="2.6" fill="#23272B"/><path d="M${vx + 4} 44 l3 -4 h12 l3 4" fill="#23272B"/></g>`);
      }
    }

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
        const real = Math.min(n - 1, Math.floor(((i + 0.5) / visibles) * n));
        p.push(`<rect data-zona="${e(t.id)}" data-est="${i}" x="${f1(q.x - 5)}" y="${f1(q.y - 5)}" width="10" height="10" fill="#F4F4F1" stroke="#23272B"><title>Estación ${C.codigoEstacion ? C.codigoEstacion(t.id, real) : ''}</title></rect>`);
      }
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

    // Capa donde se dibujan los mineros que están dentro de la mina.
    if (!op.editor) p.push('<g id="capa-mineros"></g>');

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
      ${op.editor ? '' : `${figura(560, 474, '')}<text x="574" y="475">Minero (ubicado por la estación más cercana)</text>`}
    </g>`);
    return p.join('');
  }

  // Muñequito de minero con casco. (x, y) = pies.
  function figura(x, y, clase, titulo) {
    const t = `translate(${f1(x)} ${f1(y)})`;
    const cuerpo = 'M0 -8 V-1 M0 -6 L-4 -3 M0 -6 L4 -3 M0 -1 L-3 4 M0 -1 L3 4';
    return `<g class="minero ${clase}" transform="${t}">${titulo ? `<title>${C.esc(titulo)}</title>` : ''}
      <path d="${cuerpo}" stroke="#FFFFFF" stroke-width="4.2" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="-11" r="3.6" fill="#FFFFFF"/>
      <path class="cuerpo" d="${cuerpo}" stroke="#23272B" stroke-width="1.9" stroke-linecap="round" fill="none"/>
      <circle cx="0" cy="-11" r="2.6" fill="#E8B48C"/>
      <path d="M-3.6 -11.5 a3.6 3.6 0 0 1 7.2 0 z" fill="#F2C230" stroke="#23272B" stroke-width="0.8"/>
    </g>`;
  }

  // Dibuja los mineros que están dentro, sobre su tramo.
  function dibujarMineros(svg, estado) {
    const capa = svg.querySelector('#capa-mineros');
    if (!capa || !C.personal) return;
    const html = C.personal.dentro().map((m, i) => {
      const t = C.mina.tramos.find((x) => x.id === m.zona);
      if (!t) return '';
      const q = punto(t, m.pos);
      const n = normalArriba(t);
      const desvio = ((i % 3) - 1) * 4;
      const ez = estado.zonas[m.zona];
      const clase = m.evacuando ? 'evacuando' : (ez && C.rango(ez.nivel) >= 3 ? 'en-peligro' : '');
      const est = C.personal.estacionCercana(m);
      return figura(q.x + n.nx * desvio, q.y + 6 + n.ny * desvio, clase, `${m.nombre} (${m.codigo}), cerca de la estación ${est}${m.evacuando ? ', evacuando' : ''}`);
    }).join('');
    capa.innerHTML = html;
  }

  // Marca la estación que detecta el problema en cada zona con alerta: titila.
  function marcarFocos(svg, estado) {
    svg.querySelectorAll('.estaciones rect.foco').forEach((r) => { r.setAttribute('class', ''); });
    C.zonas.forEach((z) => {
      const ez = estado.zonas[z.id];
      if (!ez || ez.nivel === 'normal') return;
      const foco = C.simulador.focoDe(estado, z.id);
      const rects = svg.querySelectorAll(`.estaciones rect[data-zona="${CSS.escape(z.id)}"]`);
      if (!rects.length) return;
      const vi = Math.min(rects.length - 1, Math.floor(((foco + 0.5) / z.estaciones) * rects.length));
      rects[vi].setAttribute('class', `foco foco-${ez.nivel}`);
    });
  }

  // Colorea el mapa según el estado: zonas, estaciones, etiquetas, cuadrillas y mineros.
  function actualizar(svg, estado) {
    if (!svg.querySelector('.tramo')) {
      svg.insertAdjacentHTML('beforeend', C.mapa.contenido(C.mina));
    }
    svg.querySelectorAll('.tramo').forEach((p) => {
      const ez = estado.zonas[p.dataset.zona];
      if (!ez) return;
      p.setAttribute('stroke', C.colores[ez.nivel]);
      p.classList.toggle('evacuando', ez.nivel === 'evacuacion');
    });
    svg.querySelectorAll('.estaciones rect[data-zona]').forEach((r) => {
      const ez = estado.zonas[r.dataset.zona];
      if (!ez) return;
      r.setAttribute('fill', ez.nivel === 'normal' ? '#F4F4F1' : '#FFFFFF');
      r.setAttribute('stroke', ez.nivel === 'normal' ? '#23272B' : C.coloresTexto[ez.nivel]);
    });
    C.zonas.forEach((z) => {
      const ez = estado.zonas[z.id];
      const lbl = document.getElementById(`lbl-${z.id}`);
      const val = document.getElementById(`val-${z.id}`);
      const color = ez.nivel === 'normal' ? '#23272B' : C.coloresTexto[ez.nivel];
      if (lbl) lbl.setAttribute('fill', color);
      if (val) {
        if (ez.nivel === 'normal') {
          val.textContent = '';
        } else {
          const nombre = ez.nivel === 'evacuacion' ? 'Evacuar' : C.niveles[ez.nivel].nombre;
          val.textContent = `${nombre}: ${ez.textoCorto}`;
          val.setAttribute('fill', color);
        }
      }
    });
    estado.cuadrillas.forEach((c) => {
      const g = document.getElementById(`cq-${c.id}`);
      if (!g) return;
      const n = C.personal.dentro().filter((m) => m.cuadrilla === c.codigo).length;
      g.style.opacity = n > 0 ? '1' : '0.35';
      g.querySelector('title').textContent = `${c.nombre}, detector ${c.codigo}: ${n} personas dentro`;
    });
    marcarFocos(svg, estado);
    dibujarMineros(svg, estado);
  }

  C.mapa = { ANCHO, ALTO, punto, normalArriba, contenido, figura, dibujarMineros, marcarFocos, actualizar };
})();
