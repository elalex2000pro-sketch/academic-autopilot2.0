# Preparación del paso 5

Rama de trabajo: `limpieza/paso5`. Respaldo íntegro previo: `respaldo/spotify-antes-retirada`, desde `405d2cb`. No se publica una versión ni se actualizan dependencias.

## Punto de partida y prerrequisitos

El main local contenía el catálogo Gemini y las correcciones de media sobre diez (`aa1d6ab`) e indicador lateral (`4acead9`), pero la retirada musical y la gestión de fallos Gemini estaban pendientes. El usuario pidió completarlas antes de las extracciones.

Antes de esos cambios: build correcto; lint correcto con 11 avisos; 89 tests backend correctos con `.venv311` y los avisos existentes. `.venv` usa Python 3.15 y no contiene las dependencias de ejecución; no usarlo como referencia de la batería. El test de transporte frontend y el test de archivos Electron pasan. No se obtuvo un smoke inicial completo antes de estos prerrequisitos; no se afirma lo contrario.

Prerrequisitos: retirada de ruta, vista, clientes web, navegación, OAuth/IPC y permiso DRM; no había dependencias exclusivas ni modelos/backend específicos. Se conservan las claves locales antiguas. Gemini informa de clave/modelo/cuota/red sin simular éxito heurístico; hay una acción para recuperar el modelo predeterminado. Las pruebas de navegador simulan respuestas e historial de proveedor, pero guardan y leen el perfil en la API SQLite aislada. No usan claves reales ni validan el acceso comercial a cada modelo.

## Plan de IA Studio aprobado

Base después de prerrequisitos: `ia-studio.tsx` 1900 líneas; `planner-view.tsx` 2493; `chat-view.tsx` 2043.

Extraer en commits separados, reutilizando `frontend/src/components/studio/` y `frontend/src/lib/studio.ts` existentes:

1. `studio-header.tsx`: cabecera, selector y recuperación Gemini, controles de conversación. Recibir estado y callbacks; conservar etiquetas y accesibilidad.
2. `studio-chat-panel.tsx`: conversación, sugerencias, contexto de libro/documento y compositor, reutilizando MessageBubble, ChatComposer y PendingActionCard.
3. `studio-audio-panel.tsx`: controles y presentación de audio, transcripción por fragmentos y acciones del material generado.
4. `studio-document-panel.tsx`: lista/carga de fuentes, materiales generados y conversación documental.

Mantener estados, efectos, temporizadores, referencias, grabación, dictado, cancelación del lector y coordinación de peticiones en IAStudio inicialmente. No introducir nuevos envoltorios de DOM ni cambiar clases, rutas, exportaciones o persistencia. Solo mover utilidades puras adicionales si se identifica una responsabilidad independiente que no exista ya en lib/studio.ts. Objetivo orientativo: reducir el coordinador a unas 1000–1100 líneas sin forzar la extracción de lógica sensible.

Verificar build, lint, typecheck, backend y smoke tras el archivo, y probar selección/envío de IA en navegador. Los casos del proveedor usan simulación; no afirmar envío real a Gemini sin clave. Presentar el mini resumen y pedir aprobación del planificador antes de modificarlo. Chat será el último; sus eventos WebSocket y efectos no se moverán sin pruebas.

## Verificación de los prerrequisitos

- Build y typecheck correctos. Lint correcto: 7 avisos existentes frente a 11 iniciales (cuatro pertenecían a la vista retirada).
- Backend: 97 tests correctos frente a 89 iniciales, con ocho casos nuevos de errores Gemini; mismos avisos existentes.
- Smoke: 52 comprobaciones de ruta/tamaño y dos recorridos adicionales de selección, recarga, respuesta de error y recuperación Gemini, a 1440 y 390 píxeles. Correctos con servidores aislados y Chrome, usando el build de producción.
- Tests de transporte frontend y archivos Electron correctos; sintaxis main/preload correcta. La búsqueda en los archivos versionados de frontend, desktop, backend, AGENTS.md y ARCHITECTURE.md no devuelve referencias a la integración retirada.
- No se ha validado una llamada real a Gemini con credenciales ni modificado el backend de producción. En ese punto no había ninguna extracción iniciada; main y los respaldos siguen conservados. Los cambios están en limpieza/paso5, sin push, versión ni tag.

## Extracciones de IA Studio

Cuatro bloques, en orden: cabecera (`299c574`), chat (`d59e412`), audio (`7978890`) y documentos (cuarto commit). Solo se trasladan JSX/imports y se declaran contratos de props, conservando nombres, clases, textos, DOM y accesibilidad. Se ha comparado contra `657f706`: todas las instrucciones anteriores al return del coordinador son idénticas, normalizando CRLF; el JSX extraído coincide literalmente. No se movieron estados, efectos, llamadas, grabación ni suscripciones.

Coordinador: 1900 → 1033 líneas. Se conservan las rutas públicas y las exportaciones IAStudio y StudioMode. Los nuevos componentes están en frontend/src/components/studio/; no se tocan planner-view ni chat-view.

Los tres primeros bloques pasan build, typecheck, 97 tests backend y smoke de Studio en escritorio/móvil. El smoke envía una consulta y comprueba la recuperación Gemini con respuestas e historial simulados; graba y detiene audio real del dispositivo de prueba de Chrome (transcripción simulada), guarda un cuaderno en la API aislada, sube/abre un PDF, genera un resumen por el fallback local y descarga un PDF real. No se usa el micrófono personal ni una clave real. La cuarta extracción se verifica con la misma batería y un smoke completo de rutas.

### Pendientes que no se cambian en esta fase

- Mantener por ahora la lógica de grabación, dictado, peticiones/cancelaciones y efectos en IAStudio; extraerla requeriría un plan específico y aprobación.
- Los paneles reciben numerosos callbacks/valores para conservar la propiedad del estado. No se introduce un contexto nuevo ni se reorganizan esos contratos ahora.
- El catálogo mantiene opciones retiradas y su aviso existente: actualizar esa política sería un cambio funcional aparte.
- Las pruebas externas de Gemini y la captura desde un micrófono físico no se afirman como realizadas; las pruebas actuales usan respuestas y dispositivo de audio de prueba.

### Resultado tras los cuatro commits

| Extracción | Líneas del coordinador antes → después | Verificación posterior |
|---|---|---|
| Cabecera | 1900 → 1720 | Build/typecheck, 97 tests backend y smoke Studio correctos |
| Chat | 1720 → 1563 | Build/typecheck, 97 tests backend y smoke Studio correctos |
| Audio | 1563 → 1314 | Build/typecheck, 97 tests backend y smoke Studio correctos |
| Documentos | 1314 → 1033 | Build/typecheck, 97 tests backend y smoke completo correctos |

Lint final correcto con los mismos 7 avisos. El smoke final completa 56 comprobaciones de ruta/tamaño y los tres recorridos de interacción de Studio en escritorio/móvil. No se observa ningún error de consola o render en esos recorridos. Artefactos locales: `C:/Users/elale/AppData/Local/Temp/academic-smoke-kc47ep`. Los tests de micrófono/transcripción usan dispositivo de prueba y respuesta simulada; generación/guardado de PDF y cuaderno usan la API aislada real con IA externa desactivada. Las verificaciones de conservación comparan el código de estados, efectos y callbacks contra la referencia, además del JSX trasladado. Backend, dependencias, planner-view, chat-view y main no se modifican en estas extracciones.

No quedan scripts temporales en el árbol. La rama limpieza/paso5 se conserva localmente y se ofrece subirla a GitHub; no se fusiona ni se publica versión/tag.
