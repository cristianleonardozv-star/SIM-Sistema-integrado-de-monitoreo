/*
 * Canario Digital - Editor de la mina (editor.html)
 * Dibuja tramos arrastrando, mueve extremos y tramos, ubica cuadrillas,
 * edita propiedades y guarda el diseño en el navegador.
 */
(function () {
  const C = window.CANARIO;
  const svg = document.getElementById('lienzo');
  const LIMITES = { xmin: 10, xmax: 890, ymin: 60, ymax: 440 };
  const AYUDAS = {
    seleccionar: 'Haz clic en un tramo o cuadrilla para editarlo. Arrastra un tramo para moverlo o arrastra sus extremos (círculos azules) para cambiar su forma.',
    tramo: 'Presiona sobre el plano y arrastra hasta donde termina el tramo. Suelta para crearlo.',
    cuadrilla: 'Haz clic sobre un tramo para ubicar allí una cuadrilla con su detector.'
  };

  let mina = clonar(C.mina);
  let modo = 'seleccionar';
  let seleccion = null;      // { tipo: 'tramo' | 'cuadrilla', id }
  let dibujo = null;         // tramo que se está dibujando
  let arrastre = null;
  let cambios = false;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function nuevoId(prefijo) { return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; }
  const tramo = (id) => mina.tramos.find((t) => t.id === id);
  const cuadrilla = (id) => mina.cuadrillas.find((c) => c.id === id);

  // ---------- Coordenadas ----------
  function aPlano(e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: q.x, y: q.y };
  }
  function limitar(p) {
    return {
      x: Math.min(LIMITES.xmax, Math.max(LIMITES.xmin, p.x)),
      y: Math.min(LIMITES.ymax, Math.max(LIMITES.ymin, p.y))
    };
  }
  // Ajusta a la rejilla de 10 y une con extremos cercanos de otros tramos.
  function ajustar(p, excluirId) {
    let q = limitar({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 });
    let mejor = 14;
    mina.tramos.forEach((t) => {
      if (t.id === excluirId) return;
      [[t.x1, t.y1], [t.x2, t.y2]].forEach(([x, y]) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < mejor) { mejor = d; q = { x, y }; }
      });
    });
    return q;
  }
  // Tramo más cercano a un punto y posición relativa sobre él.
  function tramoCercano(p) {
    let res = null;
    mina.tramos.forEach((t) => {
      const dx = t.x2 - t.x1, dy = t.y2 - t.y1;
      const L2 = dx * dx + dy * dy || 1;
      const f = Math.max(0, Math.min(1, ((p.x - t.x1) * dx + (p.y - t.y1) * dy) / L2));
      const d = Math.hypot(p.x - (t.x1 + f * dx), p.y - (t.y1 + f * dy));
      if (!res || d < res.d) res = { t, f, d };
    });
    return res;
  }

  // ---------- Dibujo ----------
  function dibujarLienzo() {
    const vista = dibujo ? { x1: dibujo.x1, y1: dibujo.y1, x2: dibujo.x2, y2: dibujo.y2 } : null;
    svg.innerHTML = C.mapa.contenido(mina, { editor: true, rejilla: true, seleccion, vistaPrevia: vista });
  }

  function dibujarListas() {
    document.getElementById('lista-tramos').innerHTML = mina.tramos.map((t) => `
      <li><button type="button" data-sel-tramo="${C.esc(t.id)}" aria-pressed="${!!(seleccion && seleccion.tipo === 'tramo' && seleccion.id === t.id)}">
        <span>${C.esc(t.nombre)}</span><span class="nota">${Math.round(C.longitud(t, mina.escala))} m, ${C.estacionesDe(t, mina.escala)} est.</span></button></li>`).join('') ||
      '<li class="nota">Todavía no hay tramos. Usa "Dibujar tramo".</li>';
    document.getElementById('lista-cuadrillas').innerHTML = mina.cuadrillas.map((c) => {
      const t = tramo(c.zona);
      return `<li><button type="button" data-sel-cuadrilla="${C.esc(c.id)}" aria-pressed="${!!(seleccion && seleccion.tipo === 'cuadrilla' && seleccion.id === c.id)}">
        <span>${C.esc(c.codigo)}: ${C.esc(c.nombre)}</span><span class="nota">${c.personas} personas, ${C.esc(t ? t.nombre : 'sin zona')}</span></button></li>`;
    }).join('') || '<li class="nota">Sin cuadrillas. Usa "Ubicar cuadrilla".</li>';

    const total = mina.tramos.reduce((s, t) => s + C.estacionesDe(t, mina.escala), 0);
    const metros = mina.tramos.reduce((s, t) => s + C.longitud(t, mina.escala), 0);
    const personas = mina.cuadrillas.reduce((s, c) => s + Number(c.personas || 0), 0);
    document.getElementById('resumen').textContent =
      `${mina.tramos.length} tramos, ${Math.round(metros)} m de galerías, ${total} estaciones fijas y ${personas} personas en ${mina.cuadrillas.length} cuadrillas.`;
    document.getElementById('escala').value = mina.escala;
  }

  function opciones(obj, actual) {
    return Object.keys(obj).map((k) => `<option value="${k}"${k === actual ? ' selected' : ''}>${C.esc(typeof obj[k] === 'string' ? obj[k] : obj[k].nombre)}</option>`).join('');
  }

  function dibujarPropiedades() {
    const cont = document.getElementById('propiedades');
    if (seleccion && seleccion.tipo === 'tramo' && tramo(seleccion.id)) {
      const t = tramo(seleccion.id);
      cont.innerHTML = `
        <label class="campo" style="flex:none">Nombre de la zona<input type="text" data-campo="nombre" value="${C.esc(t.nombre)}" maxlength="40"></label>
        <label class="campo" style="flex:none">Tipo de tramo<select data-campo="tipo">${opciones(C.tipos, t.tipo)}</select></label>
        <p class="nota">El tipo define las lecturas típicas de la zona en la simulación. Un frente tiene más metano y polvo que una galería.</p>
        <label class="campo" style="flex:none">Posición del nombre en el plano<select data-campo="etiqueta">${opciones(C.posicionesEtiqueta, t.etiqueta || 'abajo')}</select></label>
        <div class="coordenadas">
          <label class="campo">Inicio X<input type="number" step="10" data-campo="x1" value="${t.x1}"></label>
          <label class="campo">Inicio Y<input type="number" step="10" data-campo="y1" value="${t.y1}"></label>
          <label class="campo">Fin X<input type="number" step="10" data-campo="x2" value="${t.x2}"></label>
          <label class="campo">Fin Y<input type="number" step="10" data-campo="y2" value="${t.y2}"></label>
        </div>
        <p id="datos-tramo" class="nota" style="font-size:14px"></p>
        <button type="button" class="boton boton-peligro" data-accion="borrar">Eliminar tramo</button>`;
      actualizarDatosTramo();
    } else if (seleccion && seleccion.tipo === 'cuadrilla' && cuadrilla(seleccion.id)) {
      const c = cuadrilla(seleccion.id);
      const zonas = {};
      mina.tramos.forEach((t) => { zonas[t.id] = t.nombre; });
      cont.innerHTML = `
        <label class="campo" style="flex:none">Nombre<input type="text" data-campo="nombre" value="${C.esc(c.nombre)}" maxlength="30"></label>
        <label class="campo" style="flex:none">Código del detector (aparece en el plano)<input type="text" data-campo="codigo" value="${C.esc(c.codigo)}" maxlength="4"></label>
        <label class="campo" style="flex:none">Personas en la cuadrilla<input type="number" min="1" max="30" data-campo="personas" value="${c.personas}"></label>
        <label class="campo" style="flex:none">Zona donde trabaja<select data-campo="zona">${opciones(zonas, c.zona)}</select></label>
        <p class="nota">Lleva un detector por cuadrilla. También puedes arrastrarla en el plano a otro tramo.</p>
        <button type="button" class="boton boton-peligro" data-accion="borrar">Eliminar cuadrilla</button>`;
    } else {
      cont.innerHTML = `
        <p class="nota" style="font-size:14px">Selecciona un tramo o una cuadrilla en el plano o en las listas de abajo para editar sus datos.</p>
        <ol class="nota" style="font-size:14px;margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
          <li>Dibuja los tramos de la mina: bocamina, galerías, frentes, tambores y retornos.</li>
          <li>Ponle a cada uno su nombre y su tipo.</li>
          <li>Ubica las cuadrillas en los tramos donde trabajan.</li>
          <li>Pulsa "Guardar diseño" y vuelve a la sala de control.</li>
        </ol>`;
    }
  }

  function actualizarDatosTramo() {
    const el = document.getElementById('datos-tramo');
    if (!el || !seleccion || seleccion.tipo !== 'tramo') return;
    const t = tramo(seleccion.id);
    if (!t) return;
    el.textContent = `Longitud: ${Math.round(C.longitud(t, mina.escala))} m. Estaciones fijas: ${C.estacionesDe(t, mina.escala)} (una cada 30 m).`;
  }

  function actualizarCoordenadas() {
    if (!seleccion || seleccion.tipo !== 'tramo') return;
    const t = tramo(seleccion.id);
    ['x1', 'y1', 'x2', 'y2'].forEach((k) => {
      const inp = document.querySelector(`#propiedades [data-campo="${k}"]`);
      if (inp && document.activeElement !== inp) inp.value = t[k];
    });
    actualizarDatosTramo();
  }

  function todo() {
    dibujarLienzo();
    dibujarListas();
    dibujarPropiedades();
  }

  function marcarCambio() {
    cambios = true;
    const el = document.getElementById('estado-guardado');
    el.textContent = 'Cambios sin guardar';
    el.classList.add('pendiente');
    document.getElementById('errores').textContent = '';
  }

  function cambiarModo(m) {
    modo = m;
    dibujo = null;
    svg.className.baseVal = `mapa lienzo modo-${m}`;
    document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === m ? 'true' : 'false'));
    document.getElementById('ayuda').textContent = AYUDAS[m];
  }

  function seleccionar(s) {
    seleccion = s;
    todo();
  }

  function borrarSeleccion() {
    if (!seleccion) return;
    if (seleccion.tipo === 'tramo') {
      const t = tramo(seleccion.id);
      const afectadas = mina.cuadrillas.filter((c) => c.zona === t.id);
      if (afectadas.length && !confirm(`El tramo "${t.nombre}" tiene ${afectadas.length} cuadrilla(s). Se eliminarán también. ¿Continuar?`)) return;
      mina.tramos = mina.tramos.filter((x) => x.id !== t.id);
      mina.cuadrillas = mina.cuadrillas.filter((c) => c.zona !== t.id);
    } else {
      mina.cuadrillas = mina.cuadrillas.filter((c) => c.id !== seleccion.id);
    }
    seleccion = null;
    marcarCambio();
    todo();
  }

  // ---------- Interacción con el plano ----------
  svg.addEventListener('pointerdown', (e) => {
    const p = aPlano(e);
    if (modo === 'tramo') {
      const q = ajustar(p, null);
      dibujo = { x1: q.x, y1: q.y, x2: q.x, y2: q.y };
      svg.setPointerCapture(e.pointerId);
      dibujarLienzo();
      return;
    }
    if (modo === 'cuadrilla') {
      const cerca = tramoCercano(p);
      if (!cerca || cerca.d > 40) {
        document.getElementById('ayuda').textContent = 'Haz clic más cerca de un tramo para ubicar la cuadrilla.';
        return;
      }
      const n = mina.cuadrillas.length + 1;
      const c = { id: nuevoId('q'), codigo: `C${n}`, nombre: `Cuadrilla ${n}`, personas: 4, zona: cerca.t.id, pos: Math.min(0.95, Math.max(0.05, cerca.f)) };
      mina.cuadrillas.push(c);
      marcarCambio();
      cambiarModo('seleccionar');
      seleccionar({ tipo: 'cuadrilla', id: c.id });
      return;
    }
    // Modo seleccionar.
    const asa = e.target.closest('.asa');
    if (asa) {
      arrastre = { tipo: 'asa', cual: asa.dataset.asa };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const cq = e.target.closest('[data-cuadrilla]');
    if (cq) {
      arrastre = { tipo: 'cuadrilla', movio: false };
      svg.setPointerCapture(e.pointerId);
      seleccionar({ tipo: 'cuadrilla', id: cq.dataset.cuadrilla });
      return;
    }
    const tr = e.target.closest('.tramo');
    if (tr) {
      const t = tramo(tr.dataset.zona);
      arrastre = { tipo: 'mover', inicio: p, orig: { ...t }, movio: false };
      svg.setPointerCapture(e.pointerId);
      seleccionar({ tipo: 'tramo', id: t.id });
      return;
    }
    seleccionar(null);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!dibujo && !arrastre) return;
    const p = aPlano(e);
    if (dibujo) {
      const q = ajustar(p, null);
      dibujo.x2 = q.x;
      dibujo.y2 = q.y;
      dibujarLienzo();
      return;
    }
    if (arrastre.tipo === 'asa') {
      const t = tramo(seleccion.id);
      const q = ajustar(p, t.id);
      if (arrastre.cual === '1') { t.x1 = q.x; t.y1 = q.y; } else { t.x2 = q.x; t.y2 = q.y; }
      arrastre.movio = true;
    } else if (arrastre.tipo === 'mover') {
      const t = tramo(seleccion.id);
      const o = arrastre.orig;
      let dx = Math.round((p.x - arrastre.inicio.x) / 10) * 10;
      let dy = Math.round((p.y - arrastre.inicio.y) / 10) * 10;
      dx = Math.max(LIMITES.xmin - Math.min(o.x1, o.x2), Math.min(LIMITES.xmax - Math.max(o.x1, o.x2), dx));
      dy = Math.max(LIMITES.ymin - Math.min(o.y1, o.y2), Math.min(LIMITES.ymax - Math.max(o.y1, o.y2), dy));
      t.x1 = o.x1 + dx; t.y1 = o.y1 + dy; t.x2 = o.x2 + dx; t.y2 = o.y2 + dy;
      arrastre.movio = dx !== 0 || dy !== 0 || arrastre.movio;
    } else if (arrastre.tipo === 'cuadrilla') {
      const c = cuadrilla(seleccion.id);
      const cerca = tramoCercano(p);
      if (cerca && cerca.d < 60) {
        c.zona = cerca.t.id;
        c.pos = Math.min(0.95, Math.max(0.05, cerca.f));
        arrastre.movio = true;
      }
    }
    dibujarLienzo();
    actualizarCoordenadas();
  });

  function terminar() {
    if (dibujo) {
      const largo = Math.hypot(dibujo.x2 - dibujo.x1, dibujo.y2 - dibujo.y1);
      if (largo >= 20) {
        const n = mina.tramos.length + 1;
        const t = {
          id: nuevoId('z'), nombre: `Tramo ${n}`, tipo: 'galeria',
          x1: dibujo.x1, y1: dibujo.y1, x2: dibujo.x2, y2: dibujo.y2,
          etiqueta: Math.abs(dibujo.x2 - dibujo.x1) >= Math.abs(dibujo.y2 - dibujo.y1) ? 'abajo' : 'derecha'
        };
        mina.tramos.push(t);
        dibujo = null;
        marcarCambio();
        cambiarModo('seleccionar');
        seleccionar({ tipo: 'tramo', id: t.id });
        const nombre = document.querySelector('#propiedades [data-campo="nombre"]');
        if (nombre) { nombre.focus(); nombre.select(); }
        return;
      }
      dibujo = null;
      document.getElementById('ayuda').textContent = 'El tramo es muy corto. Arrastra al menos 20 puntos.';
      dibujarLienzo();
      return;
    }
    if (arrastre) {
      if (arrastre.movio) { marcarCambio(); dibujarListas(); }
      arrastre = null;
    }
  }
  svg.addEventListener('pointerup', terminar);
  svg.addEventListener('pointercancel', terminar);

  // ---------- Panel de propiedades ----------
  const propiedades = document.getElementById('propiedades');
  propiedades.addEventListener('input', (e) => {
    const campo = e.target.dataset.campo;
    if (!campo || !seleccion) return;
    const obj = seleccion.tipo === 'tramo' ? tramo(seleccion.id) : cuadrilla(seleccion.id);
    if (['x1', 'y1', 'x2', 'y2'].includes(campo)) return; // se aplica al cambiar
    if (campo === 'personas') obj.personas = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1));
    else if (campo === 'codigo') obj.codigo = e.target.value.trim().toUpperCase();
    else obj[campo] = e.target.value;
    marcarCambio();
    dibujarLienzo();
    dibujarListas();
  });
  propiedades.addEventListener('change', (e) => {
    const campo = e.target.dataset.campo;
    if (!campo || !seleccion) return;
    if (['x1', 'y1', 'x2', 'y2'].includes(campo)) {
      const t = tramo(seleccion.id);
      const v = Number(e.target.value);
      if (isNaN(v)) { e.target.value = t[campo]; return; }
      const eje = campo[0] === 'x' ? ['xmin', 'xmax'] : ['ymin', 'ymax'];
      t[campo] = Math.min(LIMITES[eje[1]], Math.max(LIMITES[eje[0]], Math.round(v)));
      e.target.value = t[campo];
      marcarCambio();
      dibujarLienzo();
      dibujarListas();
      actualizarDatosTramo();
    }
    if (campo === 'zona' && seleccion.tipo === 'cuadrilla') {
      cuadrilla(seleccion.id).pos = 0.5;
      dibujarLienzo();
    }
  });
  propiedades.addEventListener('click', (e) => {
    if (e.target.closest('[data-accion="borrar"]')) borrarSeleccion();
  });

  // ---------- Listas, herramientas y teclado ----------
  document.addEventListener('click', (e) => {
    const bt = e.target.closest('[data-sel-tramo]');
    if (bt) { cambiarModo('seleccionar'); seleccionar({ tipo: 'tramo', id: bt.dataset.selTramo }); return; }
    const bc = e.target.closest('[data-sel-cuadrilla]');
    if (bc) { cambiarModo('seleccionar'); seleccionar({ tipo: 'cuadrilla', id: bc.dataset.selCuadrilla }); return; }
    const bm = e.target.closest('[data-modo]');
    if (bm) cambiarModo(bm.dataset.modo);
  });

  document.addEventListener('keydown', (e) => {
    const enCampo = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (e.key === 'Escape') {
      if (dibujo) { dibujo = null; dibujarLienzo(); } else if (!enCampo) seleccionar(null);
      cambiarModo('seleccionar');
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !enCampo && seleccion) {
      e.preventDefault();
      borrarSeleccion();
    }
  });

  document.getElementById('escala').addEventListener('change', (e) => {
    const v = Number(e.target.value);
    mina.escala = v > 0 ? Math.min(20, v) : 1;
    marcarCambio();
    todo();
  });

  // ---------- Guardar, descartar, importar y exportar ----------
  function validar(m) {
    const errores = [];
    if (!m.tramos.length) errores.push('La mina necesita al menos un tramo.');
    const nombres = new Set();
    m.tramos.forEach((t) => {
      const n = (t.nombre || '').trim();
      if (!n) errores.push('Hay un tramo sin nombre.');
      else if (nombres.has(n.toLowerCase())) errores.push(`Hay dos tramos llamados "${n}".`);
      nombres.add(n.toLowerCase());
      if (!C.tipos[t.tipo]) errores.push(`El tramo "${n}" tiene un tipo desconocido.`);
    });
    const codigos = new Set();
    m.cuadrillas.forEach((c) => {
      if (!c.codigo) errores.push(`La cuadrilla "${c.nombre}" no tiene código de detector.`);
      else if (codigos.has(c.codigo)) errores.push(`El código de detector ${c.codigo} está repetido.`);
      codigos.add(c.codigo);
      if (!m.tramos.some((t) => t.id === c.zona)) errores.push(`La cuadrilla "${c.nombre}" no está en ningún tramo.`);
    });
    return errores;
  }

  document.getElementById('btn-guardar').addEventListener('click', () => {
    mina.tramos.forEach((t) => { t.nombre = (t.nombre || '').trim(); });
    const errores = validar(mina);
    const el = document.getElementById('errores');
    if (errores.length) { el.textContent = `No se pudo guardar: ${errores.join(' ')}`; return; }
    if (!C.minaGuardar(mina)) { el.textContent = 'No se pudo guardar: el navegador no permite guardar datos en este sitio.'; return; }
    C.almacen.borrarTodo(); // el monitoreo empieza de nuevo con la mina nueva
    C.aplicarMina(mina);
    cambios = false;
    const est = document.getElementById('estado-guardado');
    est.innerHTML = 'Diseño guardado. <a href="index.html">Ir a la sala de control</a>';
    est.classList.remove('pendiente');
  });

  document.getElementById('btn-descartar').addEventListener('click', () => {
    if (cambios && !confirm('Se perderán los cambios que no has guardado. ¿Continuar?')) return;
    mina = clonar(C.minaCargar());
    seleccion = null;
    cambios = false;
    document.getElementById('estado-guardado').textContent = 'Sin cambios';
    document.getElementById('estado-guardado').classList.remove('pendiente');
    todo();
  });

  document.getElementById('btn-ejemplo').addEventListener('click', () => {
    if (!confirm('El plano se reemplazará por la mina de ejemplo. Para aplicarlo, pulsa después "Guardar diseño". ¿Continuar?')) return;
    mina = C.minaEjemplo();
    seleccion = null;
    marcarCambio();
    todo();
  });

  document.getElementById('btn-exportar').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(mina, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diseno-mina.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('btn-importar').addEventListener('click', () => document.getElementById('archivo-importar').click());
  document.getElementById('archivo-importar').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const el = document.getElementById('errores');
      try {
        const m = JSON.parse(lector.result);
        if (!m || !Array.isArray(m.tramos) || !Array.isArray(m.cuadrillas)) throw new Error('formato');
        m.escala = Number(m.escala) > 0 ? Number(m.escala) : 1;
        m.tramos.forEach((t) => {
          ['x1', 'y1', 'x2', 'y2'].forEach((k) => { t[k] = Number(t[k]) || 0; });
          t.id = String(t.id || nuevoId('z'));
          t.nombre = String(t.nombre || 'Tramo');
          if (!C.tipos[t.tipo]) t.tipo = 'galeria';
        });
        m.cuadrillas.forEach((c) => {
          c.id = String(c.id || nuevoId('q'));
          c.personas = Math.max(1, Math.min(30, parseInt(c.personas, 10) || 1));
          c.pos = Number(c.pos) >= 0 && Number(c.pos) <= 1 ? Number(c.pos) : 0.5;
        });
        const errores = validar(m);
        if (errores.length) { el.textContent = `El archivo tiene problemas: ${errores.join(' ')}`; return; }
        mina = m;
        seleccion = null;
        marcarCambio();
        todo();
      } catch (err) {
        el.textContent = 'No se pudo leer el archivo. Debe ser un diseño exportado desde esta página.';
      }
      e.target.value = '';
    };
    lector.readAsText(archivo);
  });

  window.addEventListener('beforeunload', (e) => {
    if (cambios) { e.preventDefault(); e.returnValue = ''; }
  });

  cambiarModo('seleccionar');
  todo();
})();
