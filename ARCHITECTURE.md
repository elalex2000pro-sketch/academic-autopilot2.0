# Arquitectura de Atlantium

Identidad comercial y nombres técnicos se distinguen en
[Identificadores que no se renombran y por qué](README.md#identificadores-que-no-se-renombran-y-por-qué).

App de estudio entre alumnos. Frontend Next.js/React, API FastAPI y escritorio Electron.

## Carpetas y puntos de entrada

- `frontend/src/app/`: rutas públicas. Dashboard en `page.tsx`; Clases en `classes/`; Chat en `chat/`; documentos en `documents/` y `office/`.
- `frontend/src/components/`: vistas. Dashboard en `dashboard/`; Clases en `class/` y `class-detail-view.tsx`; Chat en `chat-view.tsx`; Office en `office/` y `academic-office-view.tsx`.
- `frontend/src/lib/` y `hooks/`: API, tipos, utilidades y coordinación de estado. `office-storage.ts` conecta el guardado; `office-docx.ts` importa/exporta DOCX.
- Office: `office-library.tsx` coordina la biblioteca; `office-document-card.tsx` y `office-version-history.tsx` presentan sus datos. `writer-editor.tsx` conserva el motor; `writer-config.ts` y `writer-*-toolbar.tsx` separan configuración y barras. `lib/office-file-actions.ts` comparte archivos nativos/descargas.
- IA: catálogo compartido en `frontend/src/lib/ai-models.ts`, selector y recuperación presentados por `studio/studio-header.tsx`, con estado y llamadas en `ia-studio.tsx`; elección persistida mediante `/assistant/profile`, con claves cifradas por usuario. Los servicios `ai_service.py` y `ai_studio_service.py` usan `ai_errors.py` para mensajes seguros de fallo de Gemini.
- IA Studio: `ia-studio.tsx` compone `studio-header.tsx`, `studio-chat-panel.tsx`, `studio-audio-panel.tsx` y `studio-document-panel.tsx` en `frontend/src/components/studio/`. Conserva estados, efectos, referencias, grabación/dictado, temporizadores, cancelación del lector y llamadas de API. Los paneles reciben valores y callbacks; reutilizan los componentes de mensajes, compositor, confirmaciones y pestañas existentes. Las utilidades siguen en `lib/studio.ts`.
- Planificador: `planner-view.tsx` conserva estado, efectos, cálculos, sincronización local/tiempo real, referencias, mutaciones, diálogos y composición EditablePanels. En `frontend/src/components/planner/`: `planner-header.tsx`, `planner-overview.tsx`, `planner-quick-event-form.tsx` (incluye QuickEventType/QUICK_EVENT_TABS), `planner-tasks-panel.tsx`, `planner-timetable-tools.tsx` y las vistas `planner-month-view.tsx`, `planner-week-view.tsx`, `planner-day-view.tsx`. Los paneles son presentación con valores/callbacks; `lib/planner.ts` sigue alojando las utilidades. Rutas /planner, /calendar y /schedule y las preferencias persistidas de paneles se conservan.
- Chat (C1–C6): `chat-view.tsx` (1506 líneas tras C6) conserva estados, efectos, WebSocket, respaldo periódico, presencia/lectura, reconciliación, peticiones, historial, scroll, refs y los componentes con efectos AttachmentCard, InviteButton y NewConversationDialog. `lib/chat-format.ts` contiene las funciones de formato; `components/chat/` aloja `chat-message-content.tsx` (MessageText/MessageTicks/Avatar), `chat-profile-panel.tsx`, `chat-conversation-list.tsx`, `chat-thread-header.tsx`, `chat-thread-composer.tsx` y `chat-message-bubble.tsx`. La cabecera recibe la misma función InviteButton del coordinador. La burbuja es presentación pura: recibe mensaje, mine/newDay calculados, tipo de conversación, adjunto ReactNode y callback de reenvío mediante props tipadas. `messages.map`, claves por ID, cálculo de cambio de día y contenedor del log permanecen en el coordinador. `chat-workspace.css` continúa importado en el punto de entrada. No se modifican realtime-provider ni class-detail-view.
- `backend/app/`: endpoints en `api/v1/`, modelos en `models/` y lógica en `services/`. Office usa `/office/documents`, `OfficeDocument` y `OfficeDocumentVersion`.
- `backend/alembic/`: migraciones. `desktop/`: IPC de archivos, controles de ventana y actualizaciones.
- `docs/`: inventarios y verificaciones. `.github/workflows/ci.yml`: controles de calidad.

## Qué tocar con cuidado

R1, temas: `frontend/src/app/design-tokens.css` es el catálogo único de valores
exactos del estilo actual para navegación y contenido: paleta, materiales,
cristal, radios, sombras y las tres familias tipográficas existentes. Se importa
antes de `globals.css` y `v18-theme.css`; estos conservan los alias, selectores,
capas y prioridades anteriores. Tailwind consume el mismo catálogo, incluidos
sus colores con opacidad y sombras coloreadas. No se añade una preferencia ni
un estilo seleccionable. La navegación usa la superficie inversa del catálogo
(oscura en ambos modos, como antes), sin un tema independiente; el indicador
móvil estático y animado comparte una sola regla `selection-indicator`.
Los colores de sombras se resuelven en el elemento consumidor para preservar
la composición de Tailwind. No mover variables dependientes de coordenadas
locales al ámbito raíz. Alcance, comparación visual y excepciones conservadas
en `docs/rediseno-r1-verificacion.md`.

`office/use-office-storage.ts` controla autoguardado, conflictos, historial y recuperación. Mantener sus claves locales, revisiones y esquema de datos. El lector PDF guarda archivos en IndexedDB; no es el mismo almacén que `/books`.

Preservar rutas, props, textos, estilos Liquid Glass y orden de efectos al extraer componentes. Cuidar selección/deshacer de CKEditor, eventos WebSocket, permisos y origen de los IPC. No modificar migraciones aplicadas ni dependencias durante la limpieza.

Mapa completo en `AGENTS.md`; dudas en `docs/limpieza-pendiente.md`; resultados antes/después en `docs/limpieza-verificacion.md`.

## Configuración: herramientas externas retiradas

En la tarea 1C se retiraron únicamente las tarjetas de NotebookLM, Canva y Word/Excel del grupo de herramientas externas de `settings-view.tsx`. Eran enlaces e instrucciones, sin rutas ni clientes exclusivos. Se conserva el acceso a Canva de IA Studio, fuera de Configuración.

`api.exportTasksExcel()` sigue siendo compartido por `task-list.tsx` y el respaldo de Ajustes; `api.exportNotebooksExcel()` por `app/notebooks/page.tsx` y ese respaldo. Se mantienen ambos clientes y `/api/v1/exports/tasks.xlsx` y `/api/v1/exports/notebooks.xlsx` (`backend/app/api/v1/exports.py`). Academic Office y sus archivos, Biblioteca, Documentos, las importaciones DOCX/XLSX, los datos y las migraciones no se modifican.

## Chat: recuperación automática (tarea 2A)

Después de las extracciones C1–C5, la tarea 2A amplía exclusivamente la lógica
de sincronización del coordinador y del proveedor; no inicia C6 ni rediseño.
`realtime-provider.tsx` conserva el WebSocket global, sus eventos y los recibos;
expone su conexión a Chat y reconecta al recuperar red/actividad o detectar
ausencia de ping. Clases utiliza los mismos eventos y no cambia de código.

`chat-view.tsx` consulta mensajes cada 30 segundos con WebSocket conectado y
cada 5 si está desconectado; los errores espacian las consultas hasta 60 segundos.
El respaldo se pausa sin internet o con la página oculta, se recupera al volver
y cancela lecturas al cambiar de conversación o desmontar la vista. En móvil,
la lista sigue actualizándose mientras el hilo está cerrado, sin consultar sus mensajes.

`chatApi.messagesSince()` lee páginas posteriores a un cursor REST independiente
de los eventos WS. El backend acepta `after=<UUID>` y `after=start` para un hilo
que estaba vacío, con orden estable y permisos de miembro. Una lectura reciente
acotada a 50 mensajes reconcilia recibos al volver/reconectar. No cambia esquemas,
migraciones ni dependencias. Contrato, despliegue y pruebas en `docs/chat-tiempo-real.md`.
