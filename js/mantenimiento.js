/*
 * SIM - Plan de mantenimiento, calibración y cambio de sensores, equipos y filtros.
 *
 * Base normativa:
 *  - Decreto 1886 de 2015, art. 11: garantizar el mantenimiento y la calibración periódica
 *    de los equipos de medición, según el fabricante y por personal habilitado.
 *  - Decreto 1886 de 2015, art. 7: "prueba de verificación" con gas patrón para saber si un
 *    detector es apto para su uso.
 *  - Circular ANM 01 de 2022: mantenimiento adecuado de los equipos por personal competente.
 *  - Guía ISEA citada por OSHA: probar los detectores antes de cada día de uso y nunca dejar
 *    pasar más de 30 días.
 * Las frecuencias marcadas como "supuesto" siguen recomendaciones típicas de fabricantes y
 * deben ajustarse a los manuales de los equipos reales.
 */
(function () {
  const C = window.CANARIO;
  const K_MANT = 'sim.mantenimiento.v1';
  const K_AVISADAS = 'sim.mantAvisadas';
  const DIA = 24 * 60 * 60 * 1000;

  const F_D1886 = 'Decreto 1886 de 2015, arts. 7 y 11';
  const F_ISEA = 'Guía ISEA y OSHA: antes de cada día de uso, máximo 30 días';
  const F_SUP = 'Supuesto: recomendación típica del fabricante';

  // Plantillas de tareas.
  const POR_ZONA = [
    { act: 'Prueba de verificación con gas patrón', equipo: 'Sensores de la estación fija', cada: 30, fuente: `${F_D1886}. ${F_ISEA}` },
    { act: 'Calibración de los sensores de gas', equipo: 'Sensores de la estación fija', cada: 180, fuente: `${F_D1886}. ${F_SUP}` },
    { act: 'Limpieza del filtro y del sensor de polvo', equipo: 'Filtro de polvo', cada: 7, fuente: F_SUP },
    { act: 'Cambio del filtro de polvo', equipo: 'Filtro de polvo', cada: 90, fuente: F_SUP },
    { act: 'Cambio de sensores electroquímicos (CO, O₂, H₂S)', equipo: 'Sensores electroquímicos', cada: 730, fuente: `${F_SUP} (vida útil de 2 a 3 años)` },
    { act: 'Prueba de la batería de respaldo', equipo: 'Circuito de seguridad', cada: 30, fuente: F_SUP }
  ];
  const POR_DETECTOR = [
    { act: 'Prueba de verificación antes del turno', cada: 1, fuente: `${F_D1886}. ${F_ISEA}` },
    { act: 'Calibración completa', cada: 180, fuente: `${F_D1886}. ${F_SUP}` }
  ];
  const GENERALES = [
    { id: 'g-ventiladores', act: 'Inspección planeada de ventiladores y ductos', equipo: 'Sistema de ventilación', ubic: 'Toda la mina', cada: 7, fuente: 'Decreto 1886 de 2015, art. 9 (inspección planeada). Frecuencia: supuesto' },
    { id: 'g-autorrescatadores', act: 'Revisión de autorrescatadores', equipo: 'Autorrescatadores', ubic: 'Lampistería', cada: 30, fuente: F_SUP },
    { id: 'g-lamparas', act: 'Mantenimiento de lámparas de casco', equipo: 'Lámparas de seguridad', ubic: 'Lampistería', cada: 30, fuente: 'Decreto 1886 de 2015, art. 7 (lampistería). Frecuencia: supuesto' },
    { id: 'g-plc', act: 'Prueba del PLC y del corte de energía', equipo: 'PLC de zona', ubic: 'Toda la mina', cada: 30, fuente: F_SUP },
    { id: 'g-fibra', act: 'Revisión del enlace de fibra y los convertidores', equipo: 'Red de comunicación', ubic: 'Mina y superficie', cada: 180, fuente: F_SUP }
  ];

  let datos = null;

  function generar(previas) {
    const ahora = Date.now();
    const prev = {};
    (previas || []).forEach((t) => { prev[t.id] = t; });
    const tareas = [];
    const semilla = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9973; return h / 9973; };
    const ultimaInicial = (id, cada) => ahora - cada * DIA * (0.1 + semilla(id) * 0.55);
    const agregar = (t) => {
      t.ultima = prev[t.id] ? prev[t.id].ultima : ultimaInicial(t.id, t.cada);
      tareas.push(t);
    };
    C.zonas.forEach((z) => {
      POR_ZONA.forEach((p, i) => agregar({ id: `z-${z.id}-${i}`, equipo: `${p.equipo} (${z.estaciones} estaciones)`, ubic: z.nombre, act: p.act, cada: p.cada, fuente: p.fuente, zona: z.id }));
    });
    C.cuadrillas.forEach((c) => {
      POR_DETECTOR.forEach((p, i) => agregar({ id: `d-${c.codigo}-${i}`, equipo: `Detector ${c.codigo}`, ubic: c.nombre, act: p.act, cada: p.cada, fuente: p.fuente }));
    });
    GENERALES.forEach((g) => agregar({ ...g }));

    // Algunos vencidos y próximos para la demostración (solo la primera vez).
    if (!previas) {
      const fijar = (pred, diasAtras) => { const t = tareas.find(pred); if (t) t.ultima = ahora - diasAtras * DIA; };
      fijar((t) => t.id.startsWith('d-') && t.id.endsWith('-0') && t.equipo.endsWith(C.cuadrillas.length ? C.cuadrillas[C.cuadrillas.length - 1].codigo : ''), 1.3);
      const frente = C.zonas.find((z) => z.tipo === 'frente');
      const retorno = C.zonas.find((z) => z.tipo === 'retorno');
      if (frente) { fijar((t) => t.id === `z-${frente.id}-2`, 8); fijar((t) => t.id === `z-${frente.id}-1`, 175); }
      if (retorno) fijar((t) => t.id === `z-${retorno.id}-0`, 32);
      fijar((t) => t.id === 'g-ventiladores', 6);
    }
    return tareas;
  }

  function cargar() {
    let d = null;
    try { const t = localStorage.getItem(K_MANT); if (t) d = JSON.parse(t); } catch (e) { /* nada */ }
    if (!d || !Array.isArray(d.tareas)) d = { version: 1, minaRev: C.mina.revision, tareas: generar(null), bitacora: [] };
    else if (d.minaRev !== C.mina.revision) { d.tareas = generar(d.tareas); d.minaRev = C.mina.revision; }
    return d;
  }
  function guardar() {
    try { localStorage.setItem(K_MANT, JSON.stringify(datos)); } catch (e) { /* nada */ }
  }

  // Estado de una tarea: vencida, próxima o al día.
  function estadoDe(t) {
    const restante = (t.ultima + t.cada * DIA - Date.now()) / DIA;
    const margen = t.cada <= 1 ? 0.25 : Math.min(7, t.cada * 0.15);
    const estado = restante < 0 ? 'vencida' : (restante <= margen ? 'proxima' : 'aldia');
    return { restante, estado, proxima: t.ultima + t.cada * DIA };
  }

  function texto(restante) {
    const abs = Math.abs(restante);
    const v = abs < 1 ? `${Math.max(1, Math.round(abs * 24))} h` : `${Math.round(abs)} día${Math.round(abs) === 1 ? '' : 's'}`;
    return restante < 0 ? `Vencida hace ${v}` : `En ${v}`;
  }

  function avisadas() {
    try { return JSON.parse(sessionStorage.getItem(K_AVISADAS) || '[]'); } catch (e) { return []; }
  }

  C.mantenimiento = {
    tareas: () => datos.tareas,
    bitacora: () => datos.bitacora,
    estadoDe,
    texto,
    vencidas: () => datos.tareas.filter((t) => estadoDe(t).estado === 'vencida'),
    deZona: (zonaId) => datos.tareas.filter((t) => t.zona === zonaId && estadoDe(t).estado === 'vencida'),

    registrar(id, nota) {
      const t = datos.tareas.find((x) => x.id === id);
      if (!t) return;
      t.ultima = Date.now();
      datos.bitacora.push({ t: Date.now(), id, act: t.act, equipo: t.equipo, ubic: t.ubic, nota: nota || '', por: 'Ingeniero de minas' });
      if (datos.bitacora.length > 300) datos.bitacora.splice(0, datos.bitacora.length - 300);
      guardar();
    },

    // Avisos de mantenimiento vencido: una vez por sesión del navegador, solo al ingeniero.
    revisar() {
      if (C.rol && C.rol() !== 'ingeniero') return [];
      const ya = avisadas();
      const nuevas = this.vencidas().filter((t) => !ya.includes(t.id));
      if (!nuevas.length) return [];
      try { sessionStorage.setItem(K_AVISADAS, JSON.stringify(ya.concat(nuevas.map((t) => t.id)))); } catch (e) { /* nada */ }
      const titulo = nuevas.length === 1 ? 'Mantenimiento vencido' : `${nuevas.length} mantenimientos vencidos`;
      const cuerpo = nuevas.slice(0, 3).map((t) => `${t.act}: ${t.equipo}, ${t.ubic}`).join('. ') + (nuevas.length > 3 ? '. Revisa la pantalla de Mantenimiento.' : '.');
      return [{ nivel: 'falla', titulo, cuerpo, sonido: true, notificar: true }];
    }
  };

  datos = cargar();
  guardar();
})();
