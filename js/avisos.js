/*
 * Canario Digital - Avisos: sonido, notificaciones del navegador y mensajes en pantalla.
 *
 * Sonidos por nivel (Web Audio API, sin archivos de audio):
 *  - Precaución: campanilla suave, se repite cada 15 s mientras haya una zona en amarillo.
 *  - Peligro: sirena fuerte, se repite cada 5 s hasta que alguien confirme la alerta.
 *  - Evacuación: sirena rápida y más aguda, cada 5 s hasta confirmar.
 *  - Falla técnica: dos tonos graves cada 15 s hasta confirmar.
 *
 * Los navegadores no dejan sonar una página hasta que la persona hace clic en ella:
 * por eso aparece una barra para activar el sonido con un clic.
 */
(function () {
  const C = window.CANARIO;
  const K_SILENCIO = 'canario.silencio';
  const REPETIR_MS = { precaucion: 15000, falla: 15000, peligro: 5000, evacuacion: 5000 };
  let ctx = null;
  let salida = null;
  let silenciado = false;
  const ultimo = {};

  function leerSilencio() {
    try { return localStorage.getItem(K_SILENCIO) === '1'; } catch (e) { return false; }
  }
  function guardarSilencio(v) {
    try { localStorage.setItem(K_SILENCIO, v ? '1' : '0'); } catch (e) { /* nada */ }
  }

  function audioListo() {
    return !!ctx && ctx.state === 'running';
  }

  function desbloquear() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      salida = ctx.createGain();
      salida.gain.value = 0.9;
      salida.connect(comp).connect(ctx.destination);
    }
    actualizarInterfaz();
    if (ctx.state !== 'running') return ctx.resume().then(actualizarInterfaz);
    return Promise.resolve();
  }

  // ---------- Sonidos ----------
  function tono(freq, inicio, dur, tipo, volumen) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, inicio);
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.02);
    g.gain.setValueAtTime(volumen, inicio + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g).connect(salida);
    o.start(inicio);
    o.stop(inicio + dur + 0.05);
  }

  function barrido(f1, f2, inicio, dur, tipo, volumen) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f1, inicio);
    o.frequency.linearRampToValueAtTime(f2, inicio + dur);
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.03);
    g.gain.setValueAtTime(volumen, inicio + dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g).connect(salida);
    o.start(inicio);
    o.stop(inicio + dur + 0.05);
  }

  const SONIDOS = {
    // Campanilla de dos notas, suave.
    precaucion(t) {
      tono(660, t, 0.35, 'sine', 0.35);
      tono(880, t + 0.32, 0.5, 'sine', 0.35);
    },
    // Dos tonos graves: algo del sistema falla.
    falla(t) {
      tono(440, t, 0.3, 'triangle', 0.4);
      tono(330, t + 0.38, 0.4, 'triangle', 0.4);
    },
    // Sirena: sube y baja dos veces, fuerte.
    peligro(t) {
      for (let i = 0; i < 2; i++) {
        barrido(650, 1250, t + i * 0.9, 0.45, 'sawtooth', 0.55);
        barrido(1250, 650, t + i * 0.9 + 0.45, 0.45, 'sawtooth', 0.55);
      }
    },
    // Sirena rápida y aguda: hay que salir.
    evacuacion(t) {
      for (let i = 0; i < 7; i++) {
        barrido(900, 1700, t + i * 0.25, 0.22, 'square', 0.6);
      }
    }
  };

  function sonar(nivel) {
    if (silenciado || !audioListo() || !SONIDOS[nivel]) return;
    SONIDOS[nivel](ctx.currentTime + 0.03);
    ultimo[nivel] = Date.now();
    if (navigator.vibrate && C.rango(nivel) >= 3) navigator.vibrate([300, 120, 300]);
  }

  // ---------- Mensajes y notificaciones ----------
  function contenedorMensajes() {
    let el = document.getElementById('mensajes');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mensajes';
      el.className = 'mensajes';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function mostrarMensaje(a) {
    const el = document.createElement('div');
    el.className = `mensaje nivel-${a.nivel}`;
    el.innerHTML = `<strong>${C.esc(a.titulo)}</strong><span>${C.esc(a.cuerpo)}</span>`;
    if (a.eventoId && a.nivel !== 'normal') {
      el.innerHTML += `<a href="alerta.html?id=${encodeURIComponent(a.eventoId)}">Ver alerta</a>`;
    }
    contenedorMensajes().appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  function notificar(a) {
    if (silenciado || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(a.titulo, {
        body: a.cuerpo,
        tag: a.eventoId || undefined,
        renotify: true,
        requireInteraction: C.rango(a.nivel) >= 3
      });
      n.onclick = () => {
        window.focus();
        if (a.eventoId) location.href = `alerta.html?id=${encodeURIComponent(a.eventoId)}`;
      };
    } catch (e) {
      // Algunos navegadores móviles no permiten crear notificaciones así.
    }
  }

  // ---------- Interfaz: barra para activar el sonido y botón de silencio ----------
  function barraSonido() {
    let el = document.getElementById('barra-sonido');
    if (!el) {
      el = document.createElement('div');
      el.id = 'barra-sonido';
      el.className = 'barra-sonido';
      el.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>
        <span>El sonido de las alertas está apagado. El navegador necesita un clic para activarlo.</span>
        <button type="button" class="boton boton-principal" id="btn-activar-sonido">Activar sonido y notificaciones</button>`;
      const header = document.querySelector('header');
      if (header) header.insertAdjacentElement('afterend', el);
      else document.body.prepend(el);
      el.querySelector('#btn-activar-sonido').addEventListener('click', activarTodo);
    }
    return el;
  }

  async function activarTodo() {
    silenciado = false;
    guardarSilencio(false);
    const listo = desbloquear();
    // Sonido de prueba para que se escuche que funciona.
    if (listo) { try { await listo; } catch (e) { /* nada */ } }
    sonar('precaucion');
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) { /* nada */ }
    }
    if ('Notification' in window && Notification.permission === 'denied') {
      mostrarMensaje({ nivel: 'falla', titulo: 'Notificaciones bloqueadas', cuerpo: 'El sonido está activo. Para recibir notificaciones fuera de la página, permite las notificaciones de este sitio en el navegador.' });
    }
    actualizarInterfaz();
  }

  function actualizarInterfaz() {
    const barra = barraSonido();
    barra.hidden = silenciado || audioListo();
    const b = document.getElementById('btn-avisos');
    if (b) {
      b.setAttribute('aria-pressed', silenciado ? 'true' : 'false');
      b.textContent = silenciado ? 'Sonido silenciado' : 'Silenciar';
    }
  }

  function alternarSilencio() {
    silenciado = !silenciado;
    guardarSilencio(silenciado);
    if (!silenciado) desbloquear();
    actualizarInterfaz();
  }

  C.avisos = {
    iniciar() {
      silenciado = leerSilencio();
      const b = document.getElementById('btn-avisos');
      if (b) b.addEventListener('click', alternarSilencio);
      // Cualquier clic o tecla en la página desbloquea el sonido.
      const alPrimerGesto = (e) => {
        if (e.target && e.target.closest && e.target.closest('#barra-sonido, #btn-avisos')) return;
        if (!silenciado) desbloquear();
      };
      document.addEventListener('pointerdown', alPrimerGesto);
      document.addEventListener('keydown', alPrimerGesto);
      actualizarInterfaz();
    },
    emitir(a) {
      mostrarMensaje(a);
      if (a.sonido) sonar(a.nivel);
      if (a.notificar) notificar(a);
    },
    // Se llama en cada lectura: repite el sonido del nivel más grave según su ritmo.
    sirena(estado) {
      const ahora = Date.now();
      const pendientes = estado.eventos.filter((e) => !e.fin && e.requiereConfirmacion && !e.confirmada);
      let nivel = null;
      pendientes.forEach((e) => {
        if (C.rango(e.nivelActual) >= 2 && (!nivel || C.rango(e.nivelActual) > C.rango(nivel))) nivel = e.nivelActual;
      });
      if (!nivel) {
        const hayAmarillo = C.zonas.some((z) => estado.zonas[z.id].nivel === 'precaucion');
        if (hayAmarillo) nivel = 'precaucion';
      }
      if (!nivel) return;
      if (!ultimo[nivel] || ahora - ultimo[nivel] >= REPETIR_MS[nivel] - 300) sonar(nivel);
    }
  };
})();
