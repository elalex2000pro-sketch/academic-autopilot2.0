# PWA instalable: tarea 9A

Base: main, PR #13 (`3d5247e`). Rama: `fix/pwa-instalable`.
Versión de la app: 1.4.0, sin cambios. Sin APK, etiquetas ni releases nuevas.

## Cambios

1. El manifiesto declara los PNG existentes de 192 y 512 píxeles y el PNG
   maskable de 512, conservando los SVG, nombre, rutas y aspecto.
2. El service worker precachea exclusivamente el recurso público adicional
   `/pdf.worker.min.mjs`. Para esa ruta concreta consulta primero la red y
   conserva respaldo offline, evitando reutilizar un worker incompatible tras
   cambiar PDF.js. No se añade caché de PDF del alumno ni de respuestas API.
   Se renueva la revisión de caché del service worker, no la versión de la app.
3. Los avisos web usan `ServiceWorkerRegistration.showNotification`, con
   comprobación de contexto seguro, soporte, permisos y registro activo. Sin
   registro disponible devuelven false; no esperan indefinidamente a `ready`.
   El puente nativo de Electron mantiene prioridad. El clic enfoca o abre el
   destino del mismo origen. No hay suscripciones, servidor ni eventos push.
4. El registro usa `updateViaCache: none` y comprueba actualizaciones al recuperar
   foco, visibilidad o conexión. El worker nuevo activa su revisión y reclama
   los clientes; se admite también el mensaje SKIP_WAITING del aviso existente.
   No se fuerza una recarga mientras el alumno escribe. Las navegaciones
   consultan primero la red; los recursos de Next mantienen nombres con hash.

## Verificación local (16 de noviembre de 2026)

- `npm run typecheck`: correcto.
- `npm run lint`: correcto, con los siete avisos anteriores.
- `npm run build`: correcto, con API de pruebas aislada.
- `node --test frontend/tests/pwa.test.cjs frontend/tests/desktop-updater.test.cjs scripts/release/check.test.cjs`:
  26 pruebas correctas (9 específicas de PWA).
- Backend: 101 pruebas correctas. Avisos de deprecación existentes de
  pytest-asyncio y Starlette/AnyIO; sin cambios en backend.
- Smoke de producción: 56 comprobaciones correctas a 1440 y 390 píxeles.
- Chrome real, perfiles temporales normales (no incógnito): manifiesto sin
  errores y `Page.getInstallabilityErrors` vacío en ambas resoluciones.
  Es una auditoría automática de instalación mediante CDP, no una puntuación
  Lighthouse ni una instalación física en Android.
- Importación de un PDF de prueba a IndexedDB, apertura del lector y navegación
  directa online para guardar sus recursos. Después, red desconectada y caché
  HTTP deshabilitada: recarga del lector y renderizado real en canvas correctos
  en ambas resoluciones. El PDF permanece en IndexedDB, fuera de Cache Storage.
- Ejecución del módulo real de avisos: `showNotification` devuelve éxito y
  `getNotifications` encuentra el aviso y su destino. Las pruebas unitarias
  cubren permiso denegado, soporte ausente, registro ausente, error del sistema,
  clic y prioridad/fallback del puente Electron.
- Con el service worker activo, GET y PUT autenticados de un documento Office
  de prueba: HTTP 200, revisión incrementada y contenido conservado. Apertura
  del WebSocket autenticado correcta. Cache Storage no contiene respuestas de
  `/api/` ni el contenido del PDF. Pruebas adicionales excluyen escrituras,
  API, WebSocket, otros orígenes y archivos privados de la nueva interceptación.
- Dos revisiones reales del service worker en un servidor temporal: nuevo
  controlador activado, cachés anteriores eliminadas y texto de prueba
  conservado tanto en memoria como en localStorage, sin recargar la página.
  La variante de prueba existe solo en memoria; no modifica recursos publicados.

La auditoría se ejecuta dentro del smoke cuando `SMOKE_WEB_MODE=start`, como
en CI. Las pruebas unitarias PWA también quedan conectadas a CI. Nunca usar
estos recorridos con cuentas personales ni contra la API de producción.

Evidencia local:

- `%TEMP%/pwa-instalable-smoke-fffwy9e7/smoke/report.json`: smoke general.
- `%TEMP%/pwa-instalable-smoke-fffwy9e7/pwa-transport-final/pwa-report.json`:
  auditoría final, transporte Office/WS, notificaciones, PDF y actualización.
- En esa última carpeta, `pwa-offline-1440.png` y `pwa-offline-390.png`.
- `%TEMP%/pwa-chromium-probe-fbghpb5n/pwa-transport-final/pwa-report.json`:
  repetición correcta con Chromium completo, el mismo canal de la auditoría CI.

Durante la preparación de la prueba, Chrome rechazó el contexto privado
(`in-incognito`); se sustituyó por perfiles temporales normales. También se
corrigió una carrera del test: ahora espera que el controlador nuevo concreto
esté activado antes de comprobar la eliminación de cachés. No se excluyen
errores de instalación ni se relajan las aserciones para hacer pasar el test.

El primer CI detectó además que headless-shell deniega el permiso de avisos
incluso tras concederlo con Playwright. Se reprodujo localmente y la auditoría
selecciona el canal `chromium` explícito (navegador completo, headless moderno),
conservando la comprobación real de `showNotification` y `getNotifications`.
No se añade ningún navegador/dependencia al proyecto: ambos binarios ya se
instalan con la orden de Chromium existente en CI. Un intento backend tuvo
`database is locked` en la prueba de presencia; otro pasó sin cambios backend.

Una pestaña abierta conserva su JavaScript en ejecución hasta navegar o
recargar normalmente; activar el worker nuevo no recarga por la fuerza el
editor. Esto evita perder cambios y no impide cargar la web nueva desde la red.

## Pendiente de Android físico

Instalar desde Chrome, comprobar icono maskable y pantalla de inicio, mostrar
el aviso en la bandeja de Android y pulsarlo, permisos y preferencias reales
del sistema, suspensión por ahorro de batería, cuotas/presión de almacenamiento
y persistencia entre reinicios. Las resoluciones móviles de Chrome en este
Windows no sustituyen esas pruebas. El puente Electron se verifica con pruebas
unitarias; no se ha reinstalado ni alterado la app personal del propietario.

El modo offline sigue siendo parcial: el primer uso requiere red y guardar los
recursos del lector. IA, envío de Chat y sincronización necesitan conexión.
No se garantiza cargar cualquier pantalla nunca visitada ni recibir avisos con
la app cerrada. Esta tarea no añade push, TWA, firma Android ni distribución.

Referencias: [criterios de Chrome](https://web.dev/articles/install-criteria),
[showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification),
[registro y updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
