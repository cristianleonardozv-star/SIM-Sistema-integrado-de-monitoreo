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
          if (m.zona !== salida) {
            m.pos -= 0.25;
            if (m.pos <= 0) { m.zona = salida; m.pos = 0.9; }
          } else {
            m.pos -= 0.3;
            if (m.pos <= 0.05) {
              m.dentro = false; m.evacuando = false;
              anotar('salida', m, 'Salió de la mina por evacuación');
              m.zona = null; m.ingreso = null;
            }
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
