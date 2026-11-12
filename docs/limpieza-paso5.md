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

## Plan propuesto: Planificador y Chat (pendiente de aprobación)

Revisión sobre `bc25478`. Planificador: **2493 líneas**; Chat: **2043 líneas**. Orden propuesto: Planificador primero, Chat después. Es el orden solicitado y permite establecer las comprobaciones de extracción antes de intervenir en una vista con sincronización de mensajes y lectura. Esta sección es solo un plan: no autoriza iniciar extracciones.

### Reglas y verificación por commit

Solo trasladar código existente, con los mismos nombres, firmas, condiciones, textos, clases, accesibilidad y rutas públicas. Los módulos nuevos tienen nombres descriptivos, pero no se renombran las funciones existentes. No introducir optimizaciones, nuevos contextos, hooks de lógica, nuevos comportamientos o dependencias. Cada fila es un commit independiente; si la revisión revela una pieza demasiado grande se divide antes de implementarla. Si exige cambiar estado, efectos o sus dependencias, detenerse y consultar.

Tras cada commit, ejecutar build y, después de que Next termine de regenerar tipos, typecheck; también lint, los 97 tests actuales del backend con `.venv311` y el smoke específico indicado. Build y typecheck no se ejecutan simultáneamente sobre `.next`. Comparar con la base: cero errores nuevos, mismos siete avisos de lint o menos. Mostrar mini resumen antes de avanzar. Al terminar cada archivo, smoke completo en escritorio y móvil y actualizar ARCHITECTURE.md con sus módulos. No modificar backend, datos, claves de almacenamiento, migraciones ni librerías. Preservar exports PlannerView y ChatView y los componentes de carga diferida que los consumen.

Los smoke usan API SQLite aislada y cuentas temporales. La apertura de rutas no acredita crear/editar/enviar: se requieren acciones explícitas y lectura de sus resultados persistidos. Una prueba no disponible se marca pendiente, nunca como superada. Se pueden añadir o ampliar tests de frontend necesarios para verificar el traslado.

### Planificador: menor a mayor riesgo

Reutilizar `components/planner/` (ya contiene MonthEmpty) y `lib/planner.ts` (ya contiene fechas, colores, nombres y formatos). No crear una segunda colección de utilidades equivalentes.

| Commit | Extracción propuesta | Qué permanece en PlannerView | Smoke específico |
|---|---|---|---|
| P1 | `planner-header.tsx`: presentación de cabecera, contadores, aviso y botones de acciones | Estado notice, aperturas de herramientas, navegación y todos los handlers | Abrir /planner y /calendar, cerrar aviso si existe, abrir herramientas y formulario rápido; escritorio/móvil |
| P2 | `planner-overview.tsx`: las tarjetas laterales de resumen, próximas fechas y exámenes, conservando ExamCard | Selectores/useMemo, eliminación y aperturas de diálogos | Seleccionar fecha, comprobar tarjetas/exámenes/fechas, abrir detalle existente, ejecutar acción sin duplicados |
| P3 | `planner-quick-event-form.tsx`: formulario rápido y su presentación de pestañas. Trasladar QuickEventType y QUICK_EVENT_TABS al mismo módulo y conservar sus nombres | Valores, setters, refs quickFormRef/quickTitleRef, addQuickEvent y openQuickAdd | Crear tarea, examen y fecha importante; verificar fecha elegida, persistencia tras recargar y foco del campo |
| P4 | `planner-tasks-panel.tsx`: formulario/listado de tareas del día y sus acciones, reutilizando TaskDialog existente | useTaskManager, busy/confirmaciones, formularios, edición, callbacks REST y diálogo | Crear/editar/completar/borrar con confirmación; mover una tarea cambiando su fecha con la edición existente y comprobar ambos días |
| P5 | `planner-timetable-tools.tsx`: presentación de herramientas de horario, formulario e importación, reutilizando WeeklyTimetable | entriesRef/classFormRef/fileInputRef, estado, applyEntries, saveClass/removeClass/importSchedule y persistencia local | Abrir desde /schedule; crear/editar una entrada local, cancelar, comprobar recarga; importar un fixture y verificar sin tocar datos reales |
| P6 | `planner-month-view.tsx`: cuadrícula y celdas del mes | monthCells, agrupaciones y cálculos useMemo, cursor, día seleccionado, selectDay y cambio de periodo | Elegir día de mes actual y contiguo; comprobar tarea/examen/fecha y selección; volver a Hoy |
| P7 | `planner-week-view.tsx`: cuadrícula semanal | weekStart/weekDays, cálculos temporales y callbacks | Cambiar semana, seleccionar día y comprobar bloques y tareas, incluyendo móvil |
| P8 | `planner-day-view.tsx`: presentación del día y horario. Si hay un bloque detallado del día independiente, separarlo como otro commit antes de ampliar esta extracción | Hora actual, selectedDay, agrupaciones, edición y borrado de clases/eventos y TaskDialog/ExamDialog de coordinación | Cambiar día, abrir/editar evento, comprobar tareas y clases, volver a mes/semana sin pérdida de selección |

P6–P8 se delimitan sobre las ramas JSX existentes de viewMode; no cambian el modelo del calendario ni la disposición. Se conserva el contenedor EditablePanels y sus identificadores/orden de paneles: son preferencias persistidas. No añadir drag-and-drop: el archivo actual no contiene handlers de arrastre de tareas; mover fecha se prueba mediante la edición que ya existe.

**Hooks/estado que se quedan por riesgo:** load/applyEntries/refreshGrades, sus useCallback, efectos de arranque, eventos de cambios de notas, useRealtime, sincronización del horario local y storage, reloj y limpieza; todos los useMemo de agrupación/fecha y los callbacks de mutación. No extraer un usePlanner en esta fase. Objetivo orientativo: reducir el archivo a unas 1100–1400 líneas; se prioriza conservar contratos sobre alcanzar una cifra.

### Chat: menor a mayor riesgo

Usar una carpeta `components/chat/` para las nuevas piezas; conservar los pickers y modal de reenvío existentes y la importación de chat-workspace.css en el punto de entrada. Los nombres propuestos de archivos pueden ajustarse antes de implementar si ya existe un equivalente.

| Commit | Extracción propuesta | Qué permanece en ChatView/archivo actual | Smoke específico |
|---|---|---|---|
| C1 | `lib/chat-format.ts`: solo readError, nameOf, conversationTitle/subtitle, initials, formatClock/formatDay, messagePreview, isImage, formatSize y presenceLabel, trasladando dependencias puras necesarias | Estado, ordenaciones/merge y reconocimiento de mensajes optimistas | @usuario, título y vista previa de chat privado/grupo, fecha/hora y presencia, imágenes/documentos |
| C2 | `chat-message-content.tsx`: MessageText, MessageTicks y Avatar, conservando nombres y props | Datos de mensaje, generación de estados y procesamiento WS | Texto/enlaces/stickers, un tick/dos ticks/lectura y avatar, con dos usuarios reales de prueba |
| C3 | `chat-profile-panel.tsx` y, en un commit posterior si no es pequeño, `chat-conversation-list.tsx`: presentación del perfil, edición del identificador, búsqueda local y lista de conversaciones | claimUsername, errores, selección, filtros/useMemo, refreshList, refs y suscripciones | Guardar @usuario, filtrar conversaciones, comprobar no leídos y abrir conversación en escritorio/móvil |
| C4 | `chat-thread-header.tsx`: cabecera del hilo y botones de acciones | Presencia/polling, invitación, mute y aperturas de extras/fondos/reenvío | Cabecera con @usuario, cambio de conversación, volver a la lista móvil, acciones existentes de silenciar/invitar |
| C5 | `chat-thread-composer.tsx`: presentación del borrador, archivo/preview, botones y pickers, sin confundirlo con studio/chat-composer.tsx | draft/file, selectFile, handleSend, refs del textarea/archivo, preview URL y limpieza, envío/subida y eventos de teclado | Enviar texto/imagen/PDF, Enter y Shift+Enter, cancelar archivo, error offline conserva borrador, escritorio/móvil |
| C6 | `chat-message-bubble.tsx`: presentación de cada mensaje con sus acciones, fechas y estados | messages.map/orden y referencias de scroll, loadOlder, lectura y reconciliación. AttachmentCard sigue definida donde está y se entrega como contenido ReactNode, sin mover su efecto | Dos usuarios: enviar/recibir sin recargar, no duplicar burbuja optimista, avanzar enviado/entregado/leído, cargar anteriores y abrir/guardar adjuntos |

**Hooks y lógica que se quedan por riesgo:** useRealtime completo (message/status/presence/reconnected), todos los efectos y limpiezas de ChatView, mountedRef/activeIdRef y refs de petición, threadVisible/atBottom/markVisibleRead, setActiveChatConversation, polling, suscripción a mutes/XP/storage y visibilidad, selección de conversación y control de respuestas tardías. Mantener sortByCreatedAt/timeValue, mergeIncomingMessage, reconcileSentMessage, sortConversations, STATUS_RANK/advancedStatus y mergeMessages en el archivo actual: son funciones puras, pero forman parte del protocolo de reconciliación y no son un primer candidato de bajo riesgo. Mantener AttachmentCard con sus efectos de blobs/descarga; también InviteButton y NewConversationDialog con sus estados, búsqueda asíncrona, cancelación y bloqueo de scroll. No introducir useChat ni mover la lógica de eventos en esta fase.

Para nuevo chat, el smoke usa el diálogo existente: buscar un @usuario de prueba y crear una conversación directa. C3 no extrae la lógica del diálogo; verifica que el traslado de perfil/lista no afecta a ese acceso.

Después de **cada commit de Chat**, ejecutar `tests/chat-e2e.cjs` contra servidores aislados: ya cubre @usuario guardado y búsqueda, conversación directa, estados sent/delivered/read por WS real, presencia, imagen, bytes PDF, validación de subida, borrador offline y móvil. Revisar selectores del test únicamente si dependían de un contenedor que no debería cambiar; un fallo de comportamiento no se solventa relajando aserciones. Complementar con `tests/class-tabs-e2e.cjs` (dos usuarios, publicaciones/respuestas en tiempo real y fijados), porque Clases usa el mismo proveedor de tiempo real. No cambiar class-detail-view ni realtime-provider para hacer pasar una extracción; detenerse y consultar si fuese necesario. Al final añadir un caso explícito de reconexión/cambio rápido de hilo si no queda cubierto por los tests existentes.

Objetivo orientativo: unas 1200–1500 líneas, con la lógica sensible y los componentes con efectos conservados. La cifra no justifica mover eventos sin cobertura.

### Mejoras detectadas y aplazadas

- Los dos coordinadores tienen oportunidades de separar hooks de carga y sincronización; quedan expresamente fuera de esta fase.
- Las funciones puras de reconciliación de Chat podrían tener pruebas unitarias específicas antes de una extracción posterior; aquí permanecen donde están.
- AttachmentCard y NewConversationDialog podrían vivir en módulos propios en otra fase, pero contienen efectos y limpieza que requieren una propuesta y cobertura propias.
- No se añaden arrastre de tareas, nuevas acciones de chat ni cambios de calendario, formato o accesibilidad. Cualquier defecto encontrado al verificar se registra y se distingue de una regresión del traslado.

No se ha modificado código de Planificador o Chat al preparar este documento. Se espera aprobación antes de iniciar P1; al terminar Planificador se presenta el resultado y se pide confirmación antes de iniciar Chat.

## Referencia de Planificador anterior a P1

Plan P1–P8 aprobado. La propuesta C5 pasa a llamarse chat-thread-composer.tsx; Chat continúa pendiente de aprobación.

Script repetible: `frontend/tests/planner-e2e.cjs`. Desde frontend, con el build existente: `$env:SMOKE_WEB_MODE='start'; node tests/planner-e2e.cjs`. Inicia servidores aislados, usa .venv311 y Chrome, crea cuentas/fixtures temporales y comprueba persistencia por la API. No toca datos de producción. Conserva informe JSON y capturas; devuelve código 1 si queda cualquier caso pendiente. El informe previo a P1 se conserva en `docs/planner-baseline.json`.

Referencia sin cambios de aplicación, commit base 73b4b82: **21 recorridos correctos y 3 pendientes**. Pasan altas y persistencia de tarea/examen/fecha, agenda, edición/cambio de fecha de tarea, completar/borrar con cancelación, horario local y recarga, navegación mes/semana/día/Hoy y selección de fecha nueva, en escritorio/móvil. Editar/cancelar/importar horario pasa en escritorio pero queda pendiente en móvil por timeout del control de edición. La comprobación estricta de consola falla en ambos tamaños por precarga RSC fallida hacia /documents. Es un fallo previo; no se silencia ni se atribuye al refactor. No se afirma smoke completamente verde. El script se repite íntegro y se comparan los casos, además del código de salida; un pendiente nuevo debe investigarse antes de avanzar.

Los intentos iniciales del script necesitaron ajustar precondiciones de UI (vista Día para tareas y nombre visible del horario). No se modificó planner-view.tsx para construir la referencia. El archivo conserva 2493 líneas.

## Resultado de P1–P8

Se completa el plan aprobado en ocho commits independientes. Solo JSX/imports/contratos de props y las constantes del formulario cambian de módulo. El coordinador conserva exactamente sus parámetros y todas las instrucciones anteriores al return (comparación AST normalizando CRLF), incluidos estados, efectos, useMemo, callbacks y llamadas. Ningún panel nuevo declara hooks de estado/efecto. No fue necesario cambiar estados o efectos para extraerlos. EditablePanels, sus ids y los diálogos de coordinación permanecen donde estaban. Chat no se ha iniciado; C5 sigue propuesto como chat-thread-composer.tsx.

| Paso | Commit | Líneas antes → después | Informe local del smoke (carpeta academic-smoke- en Temp) |
|---|---|---|---|
| P1 cabecera | ce81cbb | 2493 → 2414 | PUXckQ |
| P2 tarjetas | 250ceba | 2414 → 2279 | l4maK4 |
| P3 alta rápida y constantes | 170189b | 2279 → 2163 | nznIJP |
| P4 tareas del día | f3b149a | 2163 → 1960 | itx2iN |
| P5 herramientas horario | fe7ffb7 | 1960 → 1745 | OWOdiJ |
| P6 mes | a1d409c | 1745 → 1603 | b4un8v |
| P7 semana | 0e489de | 1603 → 1481 | n2mUtl |
| P8 día | e7c197c | 1481 → 1168 | biwukI |

Tras cada commit: build (incluye lint), typecheck y 97 tests backend correctos. Mismos siete avisos de lint y avisos existentes de pytest/Starlette. Se ejecutó el mismo planner-e2e.cjs sin cambios entre P1 y P8: los ocho informes coinciden caso por caso en viewport/nombre/estado con planner-baseline.json. Cada ejecución tiene 21 correctos y 3 pendientes; el código de salida es 1 y **no se afirma smoke específico verde**. El informe final completo se conserva en planner-final.json.

Pendientes previos conservados: (1) control de edición/importación del horario en móvil no accesible para el recorrido automatizado (timeout), (2–3) errores de precarga RSC hacia /documents en consola, en escritorio y móvil. No se ignoran ni se corrigen en esta extracción. La prueba cubre mover la fecha por edición, no arrastre inexistente. Las importaciones usan texto y API SQLite aislada con IA externa desactivada; no validan importación por IA de imágenes. No se han cambiado dependencias, backend, migraciones ni datos de producción.

El coordinador queda en **1168 líneas** frente a 2493. La guía de arquitectura refleja los ocho módulos. Las referencias a blobs y suscripciones, los temporizadores, la persistencia local del horario y los cálculos temporales siguen en el coordinador; su extracción sería otra tarea con pruebas y aprobación propias.

Cierre adicional: smoke general `npm run test:smoke` correcto después de P8, con 56 comprobaciones de rutas/tamaños y los recorridos de Studio (artefactos `C:/Users/elale/AppData/Local/Temp/academic-smoke-DY0WwR`). El éxito del smoke general no sustituye ni convierte en correctos los tres pendientes del smoke específico del Planificador. Lint final correcto con siete avisos existentes. Se retiró el script temporal de extracción; se conserva únicamente el script reutilizable de pruebas solicitado. Los commits de esta fase siguen locales, sin fusión a main, sin Pull Request, versión ni tag.

## Defectos previos del Planificador: tarea aparte

Los siguientes defectos se registraron antes de P1 y quedan fuera de esta limpieza. No se corrigen ni se ocultan en los tests:

- PLAN-01: el recorrido de editar/cancelar/importar horario en móvil se detiene por timeout del control de edición. Pendiente de diagnosticar interacción/selector y corregir en una tarea aparte.
- PLAN-02: precarga RSC hacia /documents produce error de consola en el recorrido de escritorio. Pendiente de diagnóstico y corrección aparte.
- PLAN-03: la misma precarga produce error de consola en móvil. Pendiente de diagnóstico y corrección aparte.

Baseline y resultado P1–P8 coinciden en estos tres casos. No se consideran superados porque el smoke general pase. Chat C1–C5 queda aprobado; se detendrá antes de C6 y no se tocarán estados, efectos, eventos WebSocket, realtime-provider ni class-detail-view.
