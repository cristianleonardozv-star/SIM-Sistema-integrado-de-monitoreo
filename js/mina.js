/*
 * Canario Digital - Diseño de la mina
 * La mina es una lista de tramos (cada tramo es una zona) y de cuadrillas.
 * Se edita en editor.html y se guarda en el navegador.
 */
(function () {
  const C = window.CANARIO;
  const K_MINA = 'canario.mina.v1';

  // Tipos de tramo con sus lecturas típicas (punto de partida del simulador).
  C.tipos = {
    bocamina: { nombre: 'Bocamina', base: { ch4: 0.02, o2: 20.9, co: 1, co2: 0.05, h2s: 0, polvo: 0.2, temp: 22, hum: 70, pres: 918 } },
    inclinado: { nombre: 'Inclinado o rampa', base: { ch4: 0.1, o2: 20.85, co: 3, co2: 0.09, h2s: 0, polvo: 0.5, temp: 23.5, hum: 73, pres: 919 } },
    galeria: { nombre: 'Galería', base: { ch4: 0.18, o2: 20.8, co: 5, co2: 0.12, h2s: 0, polvo: 0.9, temp: 25, hum: 76, pres: 920 } },
    frente: { nombre: 'Frente de explotación', base: { ch4: 0.32, o2: 20.6, co: 9, co2: 0.2, h2s: 0.1, polvo: 1.3, temp: 26.5, hum: 80, pres: 921 } },
    tambor: { nombre: 'Tambor o chimenea', base: { ch4: 0.36, o2: 20.7, co: 6, co2: 0.18, h2s: 0.05, polvo: 0.8, temp: 26.5, hum: 79, pres: 923 } },
    retorno: { nombre: 'Retorno de ventilación', base: { ch4: 0.26, o2: 20.6, co: 7, co2: 0.22, h2s: 0.05, polvo: 0.9, temp: 27, hum: 82, pres: 924 } }
  };

  C.posicionesEtiqueta = { abajo: 'Abajo', arriba: 'Arriba', derecha: 'A la derecha', izquierda: 'A la izquierda' };

  // Mina de ejemplo. Escala: 1 punto del plano = 1 metro.
  C.minaEjemplo = () => ({
    version: 1,
    revision: 1,
    escala: 1,
    tramos: [
      { id: 'bocamina', nombre: 'Bocamina', tipo: 'bocamina', x1: 90, y1: 60, x2: 210, y2: 190, etiqueta: 'derecha' },
      { id: 'n1-galeria', nombre: 'Nivel 1, galería principal', tipo: 'galeria', x1: 210, y1: 190, x2: 720, y2: 190, etiqueta: 'abajo' },
      { id: 'n1-frente3', nombre: 'Nivel 1, Frente 3', tipo: 'frente', x1: 720, y1: 190, x2: 850, y2: 190, etiqueta: 'abajo' },
      { id: 'n2-inclinado', nombre: 'Inclinado al nivel 2', tipo: 'inclinado', x1: 330, y1: 190, x2: 430, y2: 360, etiqueta: 'izquierda' },
      { id: 'n2-galeria', nombre: 'Nivel 2, galería', tipo: 'galeria', x1: 430, y1: 360, x2: 760, y2: 360, etiqueta: 'abajo' },
      { id: 'n2-tambor', nombre: 'Nivel 2, tambor', tipo: 'tambor', x1: 640, y1: 360, x2: 640, y2: 250, etiqueta: 'derecha' },
      { id: 'n2-retorno', nombre: 'Nivel 2, retorno de ventilación', tipo: 'retorno', x1: 760, y1: 360, x2: 850, y2: 360, etiqueta: 'abajo' }
    ],
    cuadrillas: [
      { id: 'q1', codigo: 'C1', nombre: 'Cuadrilla 1', personas: 6, zona: 'n1-galeria', pos: 0.68 },
      { id: 'q2', codigo: 'C2', nombre: 'Cuadrilla 2', personas: 4, zona: 'n2-galeria', pos: 0.27 },
      { id: 'q3', codigo: 'C3', nombre: 'Cuadrilla 3', personas: 5, zona: 'n1-frente3', pos: 0.78 }
    ]
  });

  C.longitud = (t, escala) => Math.hypot(t.x2 - t.x1, t.y2 - t.y1) * (escala || 1);
  C.estacionesDe = (t, escala) => Math.max(1, Math.round(C.longitud(t, escala) / 30));

  C.minaCargar = function () {
    try {
      const texto = localStorage.getItem(K_MINA);
      if (texto) {
        const m = JSON.parse(texto);
        if (m && Array.isArray(m.tramos) && m.tramos.length) return m;
      }
    } catch (e) { /* nada */ }
    return C.minaEjemplo();
  };

  C.minaGuardar = function (m) {
    m.revision = Date.now();
    try { localStorage.setItem(K_MINA, JSON.stringify(m)); } catch (e) { return false; }
    return true;
  };

  C.minaBorrar = function () {
    try { localStorage.removeItem(K_MINA); } catch (e) { /* nada */ }
  };

  // Convierte el diseño en las zonas y cuadrillas que usa el sistema.
  C.aplicarMina = function (m) {
    C.mina = m;
    C.zonas = m.tramos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      tipo: t.tipo,
      estaciones: C.estacionesDe(t, m.escala),
      base: { ...(C.tipos[t.tipo] || C.tipos.galeria).base }
    }));
    C.cuadrillas = m.cuadrillas
      .filter((c) => m.tramos.some((t) => t.id === c.zona))
      .map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre, zona: c.zona, personas: Number(c.personas) || 0 }));
  };

  C.aplicarMina(C.minaCargar());
})();
