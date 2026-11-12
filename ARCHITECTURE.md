# Arquitectura de Academic Autopilot

App de estudio entre alumnos. Frontend Next.js/React, API FastAPI y escritorio Electron.

## Carpetas y puntos de entrada

- `frontend/src/app/`: rutas públicas. Dashboard en `page.tsx`; Clases en `classes/`; Chat en `chat/`; documentos en `documents/` y `office/`.
- `frontend/src/components/`: vistas. Dashboard en `dashboard/`; Clases en `class/` y `class-detail-view.tsx`; Chat en `chat-view.tsx`; Office en `office/` y `academic-office-view.tsx`.
- `frontend/src/lib/` y `hooks/`: API, tipos, utilidades y coordinación de estado. `office-storage.ts` conecta el guardado; `office-docx.ts` importa/exporta DOCX.
- Office: `office-library.tsx` coordina la biblioteca; `office-document-card.tsx` y `office-version-history.tsx` presentan sus datos. `writer-editor.tsx` conserva el motor; `writer-config.ts` y `writer-*-toolbar.tsx` separan configuración y barras. `lib/office-file-actions.ts` comparte archivos nativos/descargas.
- IA: catálogo compartido en `frontend/src/lib/ai-models.ts`, selector y recuperación presentados por `studio/studio-header.tsx`, con estado y llamadas en `ia-studio.tsx`; elección persistida mediante `/assistant/profile`, con claves cifradas por usuario. Los servicios `ai_service.py` y `ai_studio_service.py` usan `ai_errors.py` para mensajes seguros de fallo de Gemini.
- IA Studio: `ia-studio.tsx` compone `studio-header.tsx`, `studio-chat-panel.tsx`, `studio-audio-panel.tsx` y `studio-document-panel.tsx` en `frontend/src/components/studio/`. Conserva estados, efectos, referencias, grabación/dictado, temporizadores, cancelación del lector y llamadas de API. Los paneles reciben valores y callbacks; reutilizan los componentes de mensajes, compositor, confirmaciones y pestañas existentes. Las utilidades siguen en `lib/studio.ts`.
- Planificador: `planner-view.tsx` conserva estado, efectos, cálculos, sincronización local/tiempo real, referencias, mutaciones, diálogos y composición EditablePanels. En `frontend/src/components/planner/`: `planner-header.tsx`, `planner-overview.tsx`, `planner-quick-event-form.tsx` (incluye QuickEventType/QUICK_EVENT_TABS), `planner-tasks-panel.tsx`, `planner-timetable-tools.tsx` y las vistas `planner-month-view.tsx`, `planner-week-view.tsx`, `planner-day-view.tsx`. Los paneles son presentación con valores/callbacks; `lib/planner.ts` sigue alojando las utilidades. Rutas /planner, /calendar y /schedule y las preferencias persistidas de paneles se conservan.
- Chat (C1–C5): `chat-view.tsx` conserva estados, efectos, WebSocket, presencia/lectura, reconciliación, peticiones, refs y los componentes con efectos AttachmentCard, InviteButton y NewConversationDialog. `lib/chat-format.ts` contiene las funciones de formato; `components/chat/` aloja `chat-message-content.tsx` (MessageText/MessageTicks/Avatar), `chat-profile-panel.tsx`, `chat-conversation-list.tsx`, `chat-thread-header.tsx` y `chat-thread-composer.tsx`. La cabecera recibe la misma función InviteButton del coordinador. El log y JSX de burbujas (C6) siguen intactos y pendientes de aprobación. `chat-workspace.css` continúa importado en el punto de entrada. No se modifican realtime-provider ni class-detail-view.
- `backend/app/`: endpoints en `api/v1/`, modelos en `models/` y lógica en `services/`. Office usa `/office/documents`, `OfficeDocument` y `OfficeDocumentVersion`.
- `backend/alembic/`: migraciones. `desktop/`: IPC de archivos, controles de ventana y actualizaciones.
- `docs/`: inventarios y verificaciones. `.github/workflows/ci.yml`: controles de calidad.

## Qué tocar con cuidado

`office/use-office-storage.ts` controla autoguardado, conflictos, historial y recuperación. Mantener sus claves locales, revisiones y esquema de datos. El lector PDF guarda archivos en IndexedDB; no es el mismo almacén que `/books`.

Preservar rutas, props, textos, estilos Liquid Glass y orden de efectos al extraer componentes. Cuidar selección/deshacer de CKEditor, eventos WebSocket, permisos y origen de los IPC. No modificar migraciones aplicadas ni dependencias durante la limpieza.

Mapa completo en `AGENTS.md`; dudas en `docs/limpieza-pendiente.md`; resultados antes/después en `docs/limpieza-verificacion.md`.
