/*
 * SIM (Sistema Integrado de Monitoreo) - Datos base del prototipo
 * Zonas, estaciones, cuadrillas y tabla de límites configurable.
 *
 * IMPORTANTE: los límites marcados como "VERIFICAR" son valores de ejemplo
 * para la demostración. Antes de presentar, confirmen cada valor contra el
 * texto oficial del Decreto 1886 de 2015 y del Decreto 944 de 2022.
 */
window.CANARIO = window.CANARIO || {};

(function () {
  const C = window.CANARIO;

  C.config = {
    intervaloMs: 5000,        // cada cuánto llegan lecturas (5 s)
    sinDatosMs: 30000,        // estación "sin comunicación" tras 30 s
    escalamientoMs: 120000,   // escalamiento si nadie confirma en 2 min
    ticksHisteresis: 3,       // lecturas normales seguidas para cerrar un evento
    maxHistorial: 10000,      // lecturas guardadas en el navegador
    minutosSemilla: 120       // historial inyectado al abrir por primera vez
  };

  // Tabla de límites configurable, con su referencia normativa.
  C.limites = {
    ch4: {
      nombre: 'Metano', corto: 'CH₄', unidad: '%', decimales: 2,
      precaucion: 0.5, peligro: 0.8, evacuacion: 1.0,
      fuente: 'Circular ANM 01 de 2022: el metano siempre por debajo de 1 %. Umbrales de 0,5 y 0,8 %: supuesto preventivo.'
    },
    o2: {
      nombre: 'Oxígeno', corto: 'O₂', unidad: '%', decimales: 1,
      min: 19.5, max: 23.5, precaucionMin: 19.8, evacuacionMin: 18.0,
      fuente: 'Decreto 944 de 2022: mínimo 19,5 % y máximo 23,5 % en volumen.'
    },
    co: {
      nombre: 'Monóxido de carbono', corto: 'CO', unidad: 'ppm', decimales: 0,
      limite: 50, fuente: 'VERIFICAR en el Decreto 1886 de 2015.'
    },
    co2: {
      nombre: 'Dióxido de carbono', corto: 'CO₂', unidad: '%', decimales: 2,
      limite: 0.5, fuente: 'VERIFICAR en el Decreto 1886 de 2015.'
    },
    h2s: {
      nombre: 'Ácido sulfhídrico', corto: 'H₂S', unidad: 'ppm', decimales: 1,
      limite: 1, fuente: 'VERIFICAR en el Decreto 1886 de 2015.'
    },
    polvo: {
      nombre: 'Polvo en suspensión', corto: 'Polvo', unidad: 'mg/m³', decimales: 1,
      limite: 3, fuente: 'VERIFICAR en el Decreto 1886 de 2015.'
    },
    temp: {
      nombre: 'Temperatura', corto: 'Temp.', unidad: '°C', decimales: 1,
      precaucion: 28, peligro: 32, fuente: 'Supuesto de diseño.'
    }
  };

  // Variables sin límite propio (solo se muestran).
  C.extras = {
    hum: { nombre: 'Humedad', corto: 'Hum.', unidad: '%', decimales: 0 },
    pres: { nombre: 'Presión', corto: 'Presión', unidad: 'hPa', decimales: 0 }
  };

  // Las zonas y cuadrillas salen del diseño de la mina (js/mina.js).
  C.zonas = [];
  C.cuadrillas = [];

  C.niveles = {
    normal: { rango: 0, nombre: 'Normal' },
    precaucion: { rango: 1, nombre: 'Precaución' },
    falla: { rango: 2, nombre: 'Falla técnica' },
    peligro: { rango: 3, nombre: 'Peligro' },
    evacuacion: { rango: 4, nombre: 'Evacuación' }
  };

  C.colores = {
    normal: '#A9AEA9', precaucion: '#F2C230', falla: '#4B4FB8',
    peligro: '#C4291C', evacuacion: '#C4291C'
  };
  C.coloresTexto = {
    normal: '#23272B', precaucion: '#5E4600', falla: '#383B91',
    peligro: '#8E1A10', evacuacion: '#8E1A10'
  };

  // ---------- Utilidades de formato ----------
  C.rango = (n) => (C.niveles[n] ? C.niveles[n].rango : 0);
  C.zona = (id) => C.zonas.find((z) => z.id === id);
  C.meta = (k) => C.limites[k] || C.extras[k] || { nombre: k, corto: k, unidad: '', decimales: 1 };
  C.formato = (k, v) => {
    const d = C.meta(k).decimales;
    return Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  C.conUnidad = (k, v) => `${C.formato(k, v)} ${C.meta(k).unidad}`;
  C.hora = (t) => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  C.horaCorta = (t) => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  C.fecha = (t) => new Date(t).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  C.duracion = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  };
  C.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
})();
