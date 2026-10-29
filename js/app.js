/*
 * SIM (Sistema Integrado de Monitoreo) - Arranque común de todas las páginas
 * Carga el estado, corre el ciclo de lecturas cada 5 s y actualiza el encabezado.
 * Cada página define CANARIO.alActualizar(estado, historial) para dibujarse.
 */
(function () {
  const C = window.CANARIO;
  let estado = null;
  let historial = null;

  function actualizarEncabezado() {
    const reloj = document.getElementById('reloj');
    if (reloj) reloj.textContent = C.hora(Date.now());

    const est = document.getElementById('estaciones');
    if (est && estado) {
      const total = C.zonas.reduce((s, z) => s + z.estaciones, 0);
      const enLinea = C.zonas.reduce((s, z) => s + estado.zonas[z.id].estacionesEnLinea, 0);
      est.textContent = `${enLinea} de ${total}`;
    }

    const badge = document.getElementById('badge-alertas');
    if (badge && estado) {
      const n = estado.eventos.filter((e) => !e.fin && e.requiereConfirmacion).length;
      badge.textContent = n;
      badge.hidden = n === 0;
    }
  }

  function badgeMantenimiento() {
    const b = document.getElementById('badge-mant');
    if (!b || !C.mantenimiento) return;
    const n = C.mantenimiento.vencidas().length;
    b.textContent = n;
    b.hidden = n === 0;
  }

  function dibujar() {
    actualizarEncabezado();
    badgeMantenimiento();
    if (typeof C.alActualizar === 'function') C.alActualizar(estado, historial);
  }

  function ciclo() {
    const ahora = Date.now();
    C.simulador.tick(estado, ahora);
    const avisos = C.motor.evaluar(estado, historial, ahora);
    if (C.personal) C.personal.tick(estado);
    if (C.mantenimiento) avisos.push(...C.mantenimiento.revisar());
    C.almacen.guardarEstado(estado);
    C.almacen.guardarHistorial(historial);
    avisos.forEach((a) => C.avisos.emitir(a));
    C.avisos.sirena(estado);
    dibujar();
  }

  // Para las acciones del usuario (confirmar, escenarios): cambia, guarda y redibuja.
  C.ejecutar = function (fn) {
    fn(estado, historial);
    C.almacen.guardarEstado(estado);
    dibujar();
  };

  function iniciar() {
    if (C.rolValido === false) return; // la página está redirigiendo al rol correcto
    estado = C.almacen.cargarEstado();
    historial = C.almacen.cargarHistorial();
    // Si la mina se rediseñó, se empieza un monitoreo nuevo.
    const valido = estado && estado.version === 2 && estado.minaRev === C.mina.revision &&
      C.zonas.every((z) => estado.zonas[z.id]);
    if (!valido) {
      estado = C.simulador.estadoInicial();
      historial = C.simulador.generarSemilla();
    }
    C.estado = () => estado;
    C.historial = () => historial;

    C.avisos.iniciar();
    ciclo();
    setInterval(ciclo, C.config.intervaloMs);
    setInterval(actualizarEncabezado, 1000);

    // Si otra pestaña cambia el estado (por ejemplo, confirma una alerta), lo tomamos.
    window.addEventListener('storage', (e) => {
      if (e.key === C.almacen.claveEstado && e.newValue) {
        try { estado = JSON.parse(e.newValue); dibujar(); } catch (err) { /* nada */ }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
