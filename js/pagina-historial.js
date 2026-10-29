/*
 * Canario Digital - Página de historial (historial.html)
 * Gráfica con franjas de nivel, tabla de eventos y exportación a CSV.
 */
(function () {
  const C = window.CANARIO;
  const VARIABLES = ['ch4', 'o2', 'co', 'co2', 'h2s', 'polvo', 'temp', 'hum', 'pres'];
  let grafica = null;
  let preparado = false;

  // Franjas de nivel por variable para la gráfica.
  function franjas(k) {
    const L = C.limites[k];
    const am = 'rgba(242,194,48,0.28)', ro = 'rgba(196,41,28,0.18)', gr = 'rgba(196,41,28,0.42)';
    if (!L) return [];
    if (k === 'ch4') return [{ d: L.precaucion, h: L.peligro, c: am }, { d: L.peligro, h: L.evacuacion, c: ro }, { d: L.evacuacion, h: 100, c: gr }];
    if (k === 'o2') return [{ d: 0, h: L.evacuacionMin, c: gr }, { d: L.evacuacionMin, h: L.min, c: ro }, { d: L.min, h: L.precaucionMin, c: am }, { d: L.max, h: 100, c: gr }];
    if (k === 'temp') return [{ d: L.precaucion, h: L.peligro, c: am }, { d: L.peligro, h: 200, c: ro }];
    return [{ d: L.limite * 0.5, h: L.limite, c: am }, { d: L.limite, h: L.limite * 2, c: ro }, { d: L.limite * 2, h: L.limite * 100, c: gr }];
  }

  function rangoEje(k) {
    const L = C.limites[k];
    if (k === 'ch4') return { min: 0, max: 1.2 };
    if (k === 'o2') return { min: 17, max: 22 };
    if (k === 'temp') return { min: 15, max: 36 };
    if (L && L.limite) return { min: 0, max: L.limite * 1.3 };
    return {};
  }

  const pluginFranjas = {
    id: 'franjas',
    beforeDatasetsDraw(chart) {
      const lista = chart.options.plugins.franjas.lista || [];
      const { ctx, chartArea: a, scales: { y } } = chart;
      lista.forEach((f) => {
        const arriba = Math.max(a.top, y.getPixelForValue(f.h));
        const abajo = Math.min(a.bottom, y.getPixelForValue(f.d));
        if (abajo <= arriba) return;
        ctx.save();
        ctx.fillStyle = f.c;
        ctx.fillRect(a.left, arriba, a.right - a.left, abajo - arriba);
        ctx.restore();
      });
    }
  };

  function preparar() {
    if (preparado) return;
    preparado = true;
    document.getElementById('f-zona').innerHTML = C.zonas.map((z) => `<option value="${z.id}"${z.tipo === 'frente' && !C.zonas.slice(0, C.zonas.indexOf(z)).some((y) => y.tipo === 'frente') ? ' selected' : ''}>${C.esc(z.nombre)}</option>`).join('');
    document.getElementById('f-variable').innerHTML = VARIABLES.map((k) => `<option value="${k}">${C.meta(k).nombre}</option>`).join('');
    ['f-zona', 'f-variable', 'f-periodo'].forEach((id) => document.getElementById(id).addEventListener('change', () => dibujar(C.estado(), C.historial())));
    document.getElementById('exp-lecturas').addEventListener('click', exportarLecturas);
    document.getElementById('exp-eventos').addEventListener('click', exportarEventos);
    document.getElementById('reiniciar').addEventListener('click', () => {
      if (confirm('Se borrarán el historial, los eventos y las alertas de esta demostración. ¿Continuar?')) {
        C.almacen.borrarTodo();
        location.reload();
      }
    });
    document.getElementById('tabla-limites').innerHTML = Object.keys(C.limites).map((k) => {
      const L = C.limites[k];
      let u;
      if (k === 'ch4') u = `Precaución ${C.conUnidad(k, L.precaucion)}, peligro ${C.conUnidad(k, L.peligro)}, evacuación ${C.conUnidad(k, L.evacuacion)}`;
      else if (k === 'o2') u = `Peligro bajo ${C.conUnidad(k, L.min)}, evacuación bajo ${C.conUnidad(k, L.evacuacionMin)} o sobre ${C.conUnidad(k, L.max)}`;
      else if (k === 'temp') u = `Precaución ${C.conUnidad(k, L.precaucion)}, peligro ${C.conUnidad(k, L.peligro)}`;
      else u = `Límite ${C.conUnidad(k, L.limite)}: precaución desde el 50 %, evacuación al doble`;
      return `<tr><th scope="row">${L.nombre}</th><td>${u}</td><td>${C.esc(L.fuente)}</td></tr>`;
    }).join('');
  }

  function filtrar(historial) {
    const zona = document.getElementById('f-zona').value;
    const minutos = Number(document.getElementById('f-periodo').value);
    const desde = minutos ? Date.now() - minutos * 60000 : 0;
    return historial.filter((h) => h.z === zona && h.t >= desde);
  }

  function dibujarGrafica(historial) {
    const k = document.getElementById('f-variable').value;
    const zona = C.zona(document.getElementById('f-zona').value);
    const datos = filtrar(historial);
    const paso = Math.max(1, Math.ceil(datos.length / 360));
    const muestra = datos.filter((_, i) => i % paso === 0 || i === datos.length - 1);
    const ult = datos[datos.length - 1];

    document.getElementById('graf-t').textContent = `${C.meta(k).nombre} en ${zona.nombre}`;
    document.getElementById('graf-resumen').textContent = ult
      ? `Valor actual ${C.conUnidad(k, ult.v[k])}. Máximo del periodo ${C.conUnidad(k, Math.max(...datos.map((d) => d.v[k])))}. ${datos.length} lecturas.`
      : 'Sin lecturas en este periodo.';

    if (typeof Chart === 'undefined') {
      document.getElementById('graf-resumen').textContent += ' No se pudo cargar Chart.js: revisa la conexión a internet.';
      return;
    }
    const eje = rangoEje(k);
    const config = {
      type: 'line',
      data: {
        labels: muestra.map((d) => C.horaCorta(d.t)),
        datasets: [{
          label: `${C.meta(k).nombre} (${C.meta(k).unidad})`,
          data: muestra.map((d) => d.v[k]),
          borderColor: '#23272B', borderWidth: 2, pointRadius: 0, tension: 0.2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 10, color: '#575C61' }, grid: { display: false } },
          y: { suggestedMin: eje.min, suggestedMax: eje.max, ticks: { color: '#575C61' }, grid: { color: '#D3D6D1' },
               title: { display: true, text: C.meta(k).unidad, color: '#575C61' } }
        },
        plugins: {
          legend: { display: false },
          franjas: { lista: franjas(k) },
          tooltip: { callbacks: { label: (c) => C.conUnidad(k, c.parsed.y) } }
        }
      },
      plugins: [pluginFranjas]
    };
    if (!grafica) {
      grafica = new Chart(document.getElementById('grafica'), config);
    } else {
      grafica.data = config.data;
      grafica.options = config.options;
      grafica.update('none');
    }
  }

  function dibujarEventos(estado) {
    const lista = estado.eventos.slice().sort((a, b) => b.inicio - a.inicio);
    document.getElementById('tabla-eventos').innerHTML = lista.map((e) => {
      const confirmo = e.confirmada ? C.esc(e.confirmadoPor) : (e.requiereConfirmacion ? (e.fin ? 'Sin confirmar' : 'Pendiente') : 'No requería');
      const duracion = e.fin ? C.duracion(e.fin - e.inicio) : 'En curso';
      return `<tr>
        <td>${C.fecha(e.inicio)} ${C.horaCorta(e.inicio)}</td>
        <td>${C.esc(C.zona(e.zona).nombre)}</td>
        <td><span class="pildora nivel-${e.nivelMax}">${C.niveles[e.nivelMax].nombre}</span></td>
        <td>${C.esc(e.causa)}</td>
        <td>${duracion}</td>
        <td>${confirmo}</td>
        <td>${C.esc(e.accion || (e.fin ? 'Ajuste automático del PLC' : 'Pendiente'))}</td>
        <td><a href="alerta.html?id=${encodeURIComponent(e.id)}">Ver</a></td></tr>`;
    }).join('');
  }

  // ---------- Exportación CSV (separador ; y coma decimal, para Excel en español) ----------
  function descargar(nombre, filas) {
    const texto = '﻿' + filas.map((f) => f.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([texto], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const num = (v) => String(v).replace('.', ',');

  function exportarLecturas() {
    const datos = filtrar(C.historial());
    const zona = C.zona(document.getElementById('f-zona').value);
    const filas = [['Fecha y hora', 'Zona', 'Nivel', ...VARIABLES.map((k) => `${C.meta(k).nombre} (${C.meta(k).unidad})`)]];
    datos.forEach((d) => filas.push([new Date(d.t).toLocaleString('es-CO'), zona.nombre, C.niveles[d.n || 'normal'].nombre, ...VARIABLES.map((k) => num(d.v[k]))]));
    descargar(`lecturas-${zona.id}.csv`, filas);
  }

  function exportarEventos() {
    const filas = [['Inicio', 'Fin', 'Zona', 'Nivel máximo', 'Causa', 'Confirmó', 'Acción', 'Nota', 'Escalada', 'Línea de tiempo']];
    C.estado().eventos.slice().sort((a, b) => a.inicio - b.inicio).forEach((e) => filas.push([
      new Date(e.inicio).toLocaleString('es-CO'), e.fin ? new Date(e.fin).toLocaleString('es-CO') : 'En curso',
      C.zona(e.zona).nombre, C.niveles[e.nivelMax].nombre, e.causa,
      e.confirmada ? e.confirmadoPor : (e.requiereConfirmacion ? 'Sin confirmar' : 'No requería'),
      e.accion || '', e.nota || '', e.escalada ? 'Sí' : 'No',
      e.timeline.map((p) => `${C.hora(p.t)} ${p.texto}`).join(' | ')
    ]));
    descargar('eventos-canario-digital.csv', filas);
  }

  function dibujar(estado, historial) {
    preparar();
    dibujarGrafica(historial);
    dibujarEventos(estado);
  }

  C.alActualizar = dibujar;
})();
