/*
 * Canario Digital - Almacenamiento en el navegador (localStorage)
 * Reemplaza la base de datos en el prototipo.
 */
(function () {
  const C = window.CANARIO;
  const K_ESTADO = 'canario.estado.v1';
  const K_HISTORIAL = 'canario.historial.v1';

  function leer(clave) {
    try {
      const texto = localStorage.getItem(clave);
      return texto ? JSON.parse(texto) : null;
    } catch (e) {
      return null;
    }
  }

  function escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {
      // Sin espacio o almacenamiento bloqueado: el prototipo sigue en memoria.
    }
  }

  C.almacen = {
    claveEstado: K_ESTADO,
    claveHistorial: K_HISTORIAL,
    cargarEstado: () => leer(K_ESTADO),
    guardarEstado: (estado) => escribir(K_ESTADO, estado),
    cargarHistorial: () => leer(K_HISTORIAL) || [],
    guardarHistorial: (historial) => {
      const max = C.config.maxHistorial;
      if (historial.length > max) historial.splice(0, historial.length - max);
      escribir(K_HISTORIAL, historial);
    },
    borrarTodo: () => {
      try {
        localStorage.removeItem(K_ESTADO);
        localStorage.removeItem(K_HISTORIAL);
      } catch (e) { /* nada */ }
    }
  };
})();
