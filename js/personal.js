/*
 * SIM - Personal de la mina
 * Mineros registrados, control de ingreso con EPP, ubicación dentro de la mina
 * (estimada por la estación fija más cercana que detecta la etiqueta de su lámpara)
 * y salida, incluida la evacuación automática.
 * Se guarda en el navegador. Los nombres de ejemplo son ficticios.
 */
(function () {
  const C = window.CANARIO;
  const K_PERSONAL = 'sim.personal.v1';
  const DIA = 24 * 60 * 60 * 1000;

  C.TURNOS = {
    1: { nombre: 'Turno 1', horario: '06:00 a 14:00', desde: 6, hasta: 14 },
    2: { nombre: 'Turno 2', horario: '14:00 a 22:00', desde: 14, hasta: 22 },
    3: { nombre: 'Turno 3', horario: '22:00 a 06:00', desde: 22, hasta: 6 }
  };
  C.turnoActual = (t) => {
    const h = new Date(t || Date.now()).getHours();
    if (h >= 6 && h < 14) return 1;
    if (h >= 14 && h < 22) return 2;
    return 3;
  };

  // Elementos de protección personal que se verifican antes de entrar.
  C.EPP = [
    { id: 'casco', nombre: 'Casco con lámpara cargada' },
    { id: 'autorrescatador', nombre: 'Autorrescatador revisado' },
    { id: 'detector', nombre: 'Detector de gases de la cuadrilla probado (prueba de verificación)' },
    { id: 'botas', nombre: 'Botas de seguridad con puntera' },
    { id: 'respiratoria', nombre: 'Protección respiratoria contra polvo' },
    { id: 'auditiva', nombre: 'Protección auditiva' },
    { id: 'gafas', nombre: 'Gafas de seguridad' },
    { id: 'guantes', nombre: 'Guantes' },
    { id: 'reflectivo', nombre: 'Ropa con cinta reflectiva' }
  ];

  C.CARGOS = ['Picador', 'Ayudante de frente', 'Malacatero', 'Electromecánico', 'Jefe de frente', 'Topógrafo'];

  const fechaISO = (t) => new Date(t).toISOString().slice(0, 10);
  const venceEn = (dias) => fechaISO(Date.now() + dias * DIA);
  C.vigente = (fecha) => !!fecha && new Date(`${fecha}T23:59:59`).getTime() >= Date.now();

  function ejemplo() {
    const turno = C.turnoActual();
    const otro = (turno % 3) + 1;
    const cods = C.cuadrillas.map((c) => c.codigo);
    const q = (i) => cods[i % Math.max(1, cods.length)] || 'C1';
    const base = [
      ['Luis Fernando Ortega', 'Jefe de frente', 0], ['Jhon Jairo Peña', 'Picador', 0], ['Wilmer Andrés Rincón', 'Picador', 0],
      ['Carlos Mario Suárez', 'Ayudante de frente', 0], ['Yesid Alberto Duarte', 'Malacatero', 1], ['Óscar Iván Contreras', 'Jefe de frente', 1],
      ['Diego Armando Villamizar', 'Picador', 1], ['Edwin Javier Parada', 'Electromecánico', 1], ['Ricardo Antonio Jaimes', 'Jefe de frente', 2],
      ['Fabián Leonardo Cárdenas', 'Picador', 2], ['Nelson Enrique Rojas', 'Picador', 2], ['Hernán Darío Mendoza', 'Ayudante de frente', 2],
      ['Juan Pablo Quintero', 'Picador', 0], ['Andrés Felipe Carvajal', 'Topógrafo', 1], ['Mauricio Esteban Pabón', 'Picador', 2],
      ['Sergio Alejandro Lizcano', 'Ayudante de frente', 0]
    ];
    return base.map(([nombre, cargo, ic], i) => ({
      id: `m${i + 1}`,
      codigo: `M-${String(i + 1).padStart(3, '0')}`,
      nombre, cargo,
      cuadrilla: q(ic),
      turno: i === 13 ? otro : turno,                         // uno de otro turno
      capacitacionHasta: i === 14 ? venceEn(-12) : venceEn(60 + i * 9),  // uno con capacitación vencida
      medicoHasta: venceEn(120 + i * 5),
      bloqueado: i === 15,                                     // uno bloqueado
      motivoBloqueo: i === 15 ? 'Pendiente de reinducción en autorrescate' : '',
      dentro: i < 12,
      zona: null, pos: 0.2 + ((i * 37) % 60) / 100, ingreso: i < 12 ? Date.now() - (40 + i * 7) * 60000 : null,
      evacuando: false, epp: i < 12 ? C.EPP.map((e) => e.id) : []
    }));
  }

  let datos = null;

  function cargar() {
    try {
      const t = localStorage.getItem(K_PERSONAL);
      if (t) {
        const d = JSON.parse(t);
        if (d && Array.isArray(d.mineros)) return d;
      }
    } catch (e) { /* nada */ }
    return { version: 1, mineros: ejemplo(), bitacora: [] };
  }

  function guardar() {
    try { localStorage.setItem(K_PERSONAL, JSON.stringify(datos)); } catch (e) { /* nada */ }
  }

  function zonaDeCuadrilla(codigo) {
    const c = C.cuadrillas.find((x) => x.codigo === codigo);
    return c ? c.zona : (C.zonas[0] && C.zonas[0].id);
  }
  function zonaSalida() {
    const b = C.zonas.find((z) => z.tipo === 'bocamina');
    return b ? b.id : (C.zonas[0] && C.zonas[0].id);
  }

  function anotar(tipo, m, texto) {
    datos.bitacora.push({ t: Date.now(), tipo, minero: m ? m.codigo : null, nombre: m ? m.nombre : null, texto });
    if (datos.bitacora.length > 300) datos.bitacora.splice(0, datos.bitacora.length - 300);
  }

  // ---------- Ruta de evacuación ----------
  // Los tramos se unen donde el extremo de uno toca a otro (en su extremo o en su mitad).
  // Con esas uniones se calcula, para cada punto de la mina, el camino más corto hasta la
  // boca de la bocamina. Así los mineros recorren todos los tramos intermedios y no saltan.
  const METROS_POR_LECTURA = 60; // velocidad de evacuación acelerada para la demo (cada 5 s)
  const TOLERANCIA = 8;          // puntos del plano para considerar que dos tramos se tocan
  let ruta = null;
  let rutaDe = null;

  function proyectar(t, x, y) {
    const dx = t.x2 - t.x1;
    const dy = t.y2 - t.y1;
    const l2 = dx * dx + dy * dy || 1;
    const p = Math.max(0, Math.min(1, ((x - t.x1) * dx + (y - t.y1) * dy) / l2));
    return { p, d: Math.hypot(t.x1 + p * dx - x, t.y1 + p * dy - y) };
  }

  function calcularRuta(mina) {
    const tramos = mina.tramos;
    const escala = mina.escala || 1;
    const nodos = {};
    const porTramo = {};
    const enlaces = {};
    const clave = (id, p) => `${id}@${p.toFixed(4)}`;
    const nodo = (id, p) => {
      const k = clave(id, p);
      if (!nodos[k]) {
        nodos[k] = { k, t: id, p, dist: Infinity, sig: null };
        (porTramo[id] = porTramo[id] || []).push(nodos[k]);
        enlaces[k] = [];
      }
      return nodos[k];
    };
    const unir = (a, b, costo) => {
      enlaces[a.k].push({ n: b, costo });
      enlaces[b.k].push({ n: a, costo });
    };

    // Uniones entre tramos.
    tramos.forEach((a) => tramos.forEach((b) => {
      if (a === b) return;
      [[0, b.x1, b.y1], [1, b.x2, b.y2]].forEach(([pb, x, y]) => {
        const r = proyectar(a, x, y);
        if (r.d <= TOLERANCIA) unir(nodo(a.id, r.p), nodo(b.id, pb), 0);
      });
    }));

    // Boca de la mina: el extremo de la bocamina más lejano de cualquier unión.
    const boca = tramos.find((t) => t.tipo === 'bocamina') || tramos[0];
    const uniones = (porTramo[boca.id] || []).map((n) => n.p);
    const lejania = (p) => (uniones.length ? Math.min(...uniones.map((u) => Math.abs(u - p))) : 1);
    const salida = nodo(boca.id, lejania(0) >= lejania(1) ? 0 : 1);

    // Tramos recorridos a lo largo: une los puntos de cada tramo en orden.
    tramos.forEach((t) => {
      const lista = (porTramo[t.id] || []).slice().sort((x, y) => x.p - y.p);
      const largo = C.longitud(t, escala);
      for (let i = 1; i < lista.length; i++) unir(lista[i - 1], lista[i], (lista[i].p - lista[i - 1].p) * largo);
    });

    // Distancia de cada punto a la salida (Dijkstra).
    salida.dist = 0;
    const pendientes = new Set(Object.values(nodos));
    while (pendientes.size) {
      let u = null;
      pendientes.forEach((n) => { if (!u || n.dist < u.dist) u = n; });
      pendientes.delete(u);
      if (u.dist === Infinity) break;
      enlaces[u.k].forEach(({ n, costo }) => {
        if (u.dist + costo < n.dist) { n.dist = u.dist + costo; n.sig = u; }
      });
    }
    return { porTramo, salida, escala };
  }

  function rutaActual() {
    if (rutaDe !== C.mina) { ruta = calcularRuta(C.mina); rutaDe = C.mina; }
    return ruta;
  }

  // Mueve al minero hacia la salida. Devuelve true cuando llegó a la boca de la mina.
  function avanzarHaciaSalida(m, metros) {
    const r = rutaActual();
    let resto = metros;
    for (let vueltas = 0; vueltas < 50 && resto > 0; vueltas++) {
      const t = C.mina.tramos.find((x) => x.id === m.zona);
      if (!t) return true;
      const largo = C.longitud(t, r.escala) || 1;
      // Punto de este tramo por donde conviene seguir hacia la salida.
      let meta = null;
      let mejor = Infinity;
      (r.porTramo[t.id] || []).forEach((n) => {
        const total = Math.abs(n.p - m.pos) * largo + n.dist;
        if (total < mejor) { mejor = total; meta = n; }
      });
      if (!meta) return null; // tramo sin conexión con la salida
      if (Math.abs(meta.p - m.pos) < 1e-6) {
        if (meta === r.salida || !meta.sig) return true;
        const s = meta.sig;
        if (s.t !== t.id) { m.zona = s.t; m.pos = s.p; continue; } // pasa al tramo vecino
        meta = s;
      }
      const d = Math.abs(meta.p - m.pos) * largo;
      if (d <= resto) { m.pos = meta.p; resto -= d; } else { m.pos += Math.sign(meta.p - m.pos) * (resto / largo); resto = 0; }
    }
    return false;
  }

  // Revisa que todos los que están dentro tengan una zona válida de la mina actual.
  function normalizar() {
    datos.mineros.forEach((m) => {
      if (m.dentro && (!m.zona || !C.zona(m.zona))) m.zona = zonaDeCuadrilla(m.cuadrilla);
      if (m.dentro && !m.zona) m.dentro = false;
    });
  }

  C.personal = {
    datos: () => datos,
    mineros: () => datos.mineros,
    dentro: () => datos.mineros.filter((m) => m.dentro),
    enZona: (zonaId) => datos.mineros.filter((m) => m.dentro && m.zona === zonaId),
    porCodigo: (codigo) => datos.mineros.find((m) => m.codigo === codigo),
    bitacora: () => datos.bitacora,
    guardar,

    // Estación fija más cercana al minero (cada 30 m).
    estacionCercana(m) {
      const z = C.zona(m.zona);
      if (!z) return '';
      const i = Math.min(z.estaciones - 1, Math.floor(m.pos * z.estaciones));
      return C.codigoEstacion(z.id, i);
    },

    // Verifica las condiciones de ingreso. Devuelve una lista de { ok, texto }.
    evaluarIngreso(m, zonaId, epp, estado) {
      const lista = [];
      const ta = C.turnoActual();
      lista.push({ ok: !m.dentro, texto: m.dentro ? 'Ya está registrado dentro de la mina' : 'No está dentro de la mina' });
      lista.push({ ok: !m.bloqueado, texto: m.bloqueado ? `Bloqueado por el supervisor: ${m.motivoBloqueo || 'sin motivo'}` : 'Sin bloqueos' });
      lista.push({ ok: Number(m.turno) === ta, texto: Number(m.turno) === ta ? `Es su turno (${C.TURNOS[ta].nombre}, ${C.TURNOS[ta].horario})` : `No es su turno: tiene el ${C.TURNOS[m.turno].nombre} (${C.TURNOS[m.turno].horario})` });
      lista.push({ ok: C.vigente(m.capacitacionHasta), texto: C.vigente(m.capacitacionHasta) ? `Capacitación en seguridad vigente hasta ${m.capacitacionHasta}` : `Capacitación en seguridad vencida (${m.capacitacionHasta})` });
      lista.push({ ok: C.vigente(m.medicoHasta), texto: C.vigente(m.medicoHasta) ? `Examen médico vigente hasta ${m.medicoHasta}` : `Examen médico vencido (${m.medicoHasta})` });
      const ez = estado && estado.zonas[zonaId];
      const zonaOk = ez && C.rango(ez.nivel) < 2;
      lista.push({ ok: !!zonaOk, texto: ez ? (zonaOk ? `Zona de destino en ${C.niveles[ez.nivel].nombre}` : `Zona de destino en ${C.niveles[ez.nivel].nombre}: ingreso bloqueado`) : 'Elige la zona de destino' });
      const faltan = C.EPP.filter((e) => !epp.includes(e.id));
      lista.push({ ok: !faltan.length, texto: faltan.length ? `Faltan ${faltan.length} elementos de protección personal` : 'Lista de EPP completa' });
      return lista;
    },

    autorizarIngreso(m, zonaId, epp) {
      m.dentro = true;
      m.zona = zonaId;
      m.pos = 0.08;
      m.ingreso = Date.now();
      m.evacuando = false;
      m.epp = epp.slice();
      anotar('ingreso', m, `Ingresó a ${C.zona(zonaId).nombre} con la lista de EPP completa`);
      guardar();
    },

    rechazarIngreso(m, motivos) {
      anotar('rechazo', m, `Ingreso no autorizado: ${motivos.join('; ')}`);
      guardar();
    },

    registrarSalida(m, motivo) {
      m.dentro = false;
      m.evacuando = false;
      anotar('salida', m, motivo || 'Salida registrada');
      m.zona = null;
      m.ingreso = null;
      guardar();
    },

    bloquear(m, motivo) {
      m.bloqueado = true;
      m.motivoBloqueo = motivo;
      anotar('bloqueo', m, `Bloqueado: ${motivo}`);
      guardar();
    },
    permitir(m) {
      m.bloqueado = false;
      m.motivoBloqueo = '';
      anotar('permiso', m, 'Se le permite de nuevo el ingreso');
      guardar();
    },

    registrar(nuevo) {
      const n = datos.mineros.length + 1;
      let codigo = `M-${String(n).padStart(3, '0')}`;
      while (datos.mineros.some((m) => m.codigo === codigo)) codigo = `M-${String(Math.floor(Math.random() * 900) + 100)}`;
      const m = {
        id: `m${Date.now().toString(36)}`, codigo, nombre: nuevo.nombre, cargo: nuevo.cargo, cuadrilla: nuevo.cuadrilla,
        turno: Number(nuevo.turno), capacitacionHasta: nuevo.capacitacionHasta, medicoHasta: nuevo.medicoHasta,
        bloqueado: false, motivoBloqueo: '', dentro: false, zona: null, pos: 0.1, ingreso: null, evacuando: false, epp: []
      };
      datos.mineros.push(m);
      anotar('registro', m, 'Nuevo minero registrado');
      guardar();
      return m;
    },

    // Movimiento en cada lectura: caminan por su tramo; en Evacuación salen hacia la bocamina.
    tick(estado) {
      normalizar();
      const salida = zonaSalida();
      datos.mineros.forEach((m, i) => {
        if (!m.dentro) return;
        const ez = estado.zonas[m.zona];
        if (ez && ez.nivel === 'evacuacion' && !m.evacuando) {
          m.evacuando = true;
          anotar('evacuacion', m, `Evacuación de ${C.zona(m.zona).nombre}`);
        }
        if (m.evacuando) {
          let llego = avanzarHaciaSalida(m, METROS_POR_LECTURA);
          if (llego === null) {
            // Tramo dibujado sin conexión con la bocamina: se lleva a la bocamina como antes.
            m.zona = salida; m.pos = 0.5; llego = false;
          }
          if (llego) {
            m.dentro = false; m.evacuando = false;
            anotar('salida', m, 'Salió de la mina por evacuación');
            m.zona = null; m.ingreso = null;
          }
          return;
        }
        const paso = (Math.sin(Date.now() / 20000 + i * 1.7) * 0.04) + (Math.random() - 0.5) * 0.04;
        m.pos = Math.min(0.95, Math.max(0.05, m.pos + paso));
      });
      guardar();
    },

    reiniciar() {
      datos = { version: 1, mineros: ejemplo(), bitacora: [] };
      normalizar();
      guardar();
    }
  };

  datos = cargar();
  normalizar();
})();
