# Preparación del paso 5

Rama de trabajo: `limpieza/paso5`. Respaldo íntegro previo: `respaldo/spotify-antes-retirada`, desde `405d2cb`. No se publica una versión ni se actualizan dependencias.

## Punto de partida y prerrequisitos

El main local contenía el catálogo Gemini y las correcciones de media sobre diez (`aa1d6ab`) e indicador lateral (`4acead9`), pero la retirada musical y la gestión de fallos Gemini estaban pendientes. El usuario pidió completarlas antes de las extracciones.

Antes de esos cambios: build correcto; lint correcto con 11 avisos; 89 tests backend correctos con `.venv311` y los avisos existentes. `.venv` usa Python 3.15 y no contiene las dependencias de ejecución; no usarlo como referencia de la batería. El test de transporte frontend y el test de archivos Electron pasan. No se obtuvo un smoke inicial completo antes de estos prerrequisitos; no se afirma lo contrario.

Prerrequisitos: retirada de ruta, vista, clientes web, navegación, OAuth/IPC y permiso DRM; no había dependencias exclusivas ni modelos/backend específicos. Se conservan las claves locales antiguas. Gemini informa de clave/modelo/cuota/red sin simular éxito heurístico; hay una acción para recuperar el modelo predeterminado. Las pruebas de navegador simulan respuestas e historial de proveedor, pero guardan y leen el perfil en la API SQLite aislada. No usan claves reales ni validan el acceso comercial a cada modelo.

## Propuesta de IA Studio (pendiente de aprobación)

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
- No se ha validado una llamada real a Gemini con credenciales ni modificado el backend de producción. Ninguna extracción iniciada; main y los respaldos siguen conservados. Los cambios están en limpieza/paso5, sin push, versión ni tag.
