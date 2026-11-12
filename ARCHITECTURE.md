# Arquitectura de Academic Autopilot

App de estudio entre alumnos. Frontend Next.js/React, API FastAPI y escritorio Electron.

## Carpetas y puntos de entrada

- `frontend/src/app/`: rutas públicas. Dashboard en `page.tsx`; Clases en `classes/`; Chat en `chat/`; documentos en `documents/` y `office/`.
- `frontend/src/components/`: vistas. Dashboard en `dashboard/`; Clases en `class/` y `class-detail-view.tsx`; Chat en `chat-view.tsx`; Office en `office/` y `academic-office-view.tsx`.
- `frontend/src/lib/` y `hooks/`: API, tipos, utilidades y coordinación de estado. `office-storage.ts` conecta el guardado; `office-docx.ts` importa/exporta DOCX.
- Office: `office-library.tsx` coordina la biblioteca; `office-document-card.tsx` y `office-version-history.tsx` presentan sus datos. `writer-editor.tsx` conserva el motor; `writer-config.ts` y `writer-*-toolbar.tsx` separan configuración y barras. `lib/office-file-actions.ts` comparte archivos nativos/descargas.
- `backend/app/`: endpoints en `api/v1/`, modelos en `models/` y lógica en `services/`. Office usa `/office/documents`, `OfficeDocument` y `OfficeDocumentVersion`.
- `backend/alembic/`: migraciones. `desktop/`: IPC de archivos, OAuth y actualizaciones.
- `docs/`: inventarios y verificaciones. `.github/workflows/ci.yml`: controles de calidad.

## Qué tocar con cuidado

`office/use-office-storage.ts` controla autoguardado, conflictos, historial y recuperación. Mantener sus claves locales, revisiones y esquema de datos. El lector PDF guarda archivos en IndexedDB; no es el mismo almacén que `/books`.

Preservar rutas, props, textos, estilos Liquid Glass y orden de efectos al extraer componentes. Cuidar selección/deshacer de CKEditor, eventos WebSocket, permisos y origen de los IPC. No modificar migraciones aplicadas ni dependencias durante la limpieza.

Mapa completo en `AGENTS.md`; dudas en `docs/limpieza-pendiente.md`; resultados antes/después en `docs/limpieza-verificacion.md`.
