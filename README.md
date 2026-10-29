# SIM: Sistema Integrado de Monitoreo

Sistema inteligente de monitoreo de atmósferas mineras. Prototipo para hackatón.

Vigila el aire de una mina subterránea de carbón, alerta a los mineros y a superficie cuando hay peligro y muestra cómo el PLC de cada zona actúa automáticamente sobre la ventilación y la energía.

Este prototipo **no usa base de datos ni servidor**: las lecturas se generan con un simulador en el navegador y el historial se guarda en `localStorage`. Por eso funciona directamente en GitHub Pages.

## Roles y pantallas

Al abrir `index.html` se elige el rol, sin contraseña (prototipo):

| Rol | Pantallas |
| --- | --- |
| **Supervisor de personal** | `supervisor.html`: mineros dentro de la mina y su ubicación en el mapa, control de ingreso con requisitos y lista de chequeo de EPP, registro de mineros, bloqueo y permiso de ingreso. También ve `alerta.html`. |
| **Ingeniero de minas** | `ingeniero.html` (monitoreo), `alerta.html`, `historial.html`, `mantenimiento.html` (calibración, pruebas y cambio de sensores, filtros y equipos, con aviso cuando se vencen) y `editor.html` (diseño de la mina). |

En el mapa, cada minero aparece como un muñequito con casco, ubicado por la estación fija más cercana. Cuando una zona entra en alerta, la estación que detectó el problema titila.

## Cómo abrirlo en Visual Studio Code

1. Abre la carpeta `canario-digital` en VS Code.
2. Instala la extensión **Live Server**.
3. Clic derecho en `index.html` y elige **Open with Live Server**.

Úsalo con Live Server (o en GitHub Pages) y no abriendo el archivo con doble clic: las notificaciones del navegador solo funcionan en `http://localhost` o en `https://`.

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `canario-digital`.
2. Sube estos archivos a la rama `main` (desde la pestaña de control de código fuente de VS Code o con `git push`).
3. En el repositorio entra a **Settings, Pages**, elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
4. En uno o dos minutos queda en `https://TU-USUARIO.github.io/canario-digital/`.

## Cómo hacer la demostración

1. Al abrir la página aparece una barra amarilla: pulsa **Activar sonido y notificaciones** y acepta el permiso del navegador. Suena una campanilla de prueba. (Los navegadores no dejan sonar una página hasta que la persona hace clic en ella.)
2. En la sala de control, en el **Panel de simulación**, elige una zona (por ejemplo, Nivel 1, Frente 3) y pulsa **Subir metano**.
3. Cada 5 segundos el metano sube y la zona pasa por los niveles:
   - **Precaución (amarillo):** campanilla suave cada 15 s y notificación.
   - **Peligro (rojo):** sirena fuerte cada 5 s hasta que alguien confirme la alerta, y notificación.
   - **Evacuación (rojo intermitente con franjas):** el metano llegó a 1,0 %. Sirena rápida, el PLC corta la energía y las personas van saliendo de la zona.
4. Entra a **Alertas**, elige la acción ordenada y pulsa **Confirmar y registrar**: la sirena se silencia. Si nadie confirma en 2 minutos, la alerta se escala al jefe de seguridad.
5. Pulsa **Normalizar todo**: la zona vuelve a Normal y el evento se cierra tras unas lecturas estables (histéresis).
6. En **Historial** muestra la gráfica, el evento registrado y exporta el reporte en CSV.

Otros escenarios: polvo (si sube junto con el metano, el nivel sube un grado), oxígeno bajo, posible incendio (temperatura y CO juntos), caída de presión y una estación sin datos (falla técnica a los 30 s).

El botón **Silenciar** del encabezado apaga los sonidos y notificaciones; púlsalo de nuevo para activarlos.

Abre la aplicación en **una sola pestaña** durante la demo: cada pestaña abierta genera sus propias lecturas.

## Cómo diseñar la mina

En **Diseñar mina**:

1. **Dibujar tramo:** presiona sobre el plano y arrastra hasta donde termina el tramo. Los extremos se unen solos a los tramos cercanos.
2. **Seleccionar y mover:** arrastra un tramo para moverlo o sus círculos azules para cambiar su forma. En **Propiedades** cambias el nombre, el tipo (bocamina, inclinado, galería, frente, tambor o retorno), la posición del nombre y las coordenadas exactas.
3. **Ubicar cuadrilla:** haz clic sobre un tramo. Luego edita su nombre, el código del detector y el número de personas, o arrástrala a otro tramo.
4. Pulsa **Guardar diseño**. La sala de control empieza a monitorear la nueva mina con un historial nuevo.

Las estaciones fijas se calculan solas: una cada 30 m según la escala (metros por punto del plano). También puedes exportar el diseño a un archivo JSON e importarlo en otro computador.

## Estructura

```
canario-digital/
├── index.html, alerta.html, historial.html, editor.html
├── css/estilos.css        Colores, tipografía y componentes
└── js/
    ├── datos.js           Tabla de límites, niveles y utilidades
    ├── mina.js            Diseño de la mina: tramos, tipos y cuadrillas
    ├── mapa.js            Dibuja el corte de la mina desde el diseño
    ├── editor.js          Pantalla para diseñar la mina
    ├── almacen.js         Guarda estado e historial en localStorage
    ├── motor.js           Niveles, reglas combinadas, acciones del PLC, eventos y escalamiento
    ├── simulador.js       Lecturas cada 5 s, historial inicial y escenarios de la demo
    ├── avisos.js          Sonido por nivel, notificaciones del navegador y mensajes
    ├── app.js             Ciclo común de todas las páginas
    └── pagina-*.js        Lógica de cada pantalla
```

## Límites y normativa

Los límites están en `js/datos.js` con su referencia. El metano usa el criterio de la Circular ANM 01 de 2022 (siempre por debajo de 1 %) y el oxígeno el rango del Decreto 944 de 2022 (19,5 % a 23,5 %). **Los valores de CO, CO₂, H₂S, polvo y temperatura son de ejemplo y deben verificarse** contra el texto oficial del Decreto 1886 de 2015 y del Decreto 944 de 2022 antes de presentar.

En un despliegue real, los sensores, el PLC y los detectores serían equipos certificados para minería subterránea (Grupo I, IEC 60079), y los datos de los trabajadores se tratarían según la Ley 1581 de 2012.

## Reiniciar la demo

En **Historial**, botón **Reiniciar los datos de la demo**. También se puede borrar el almacenamiento del sitio desde las herramientas del navegador.
