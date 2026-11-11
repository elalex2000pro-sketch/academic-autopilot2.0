# Academic Autopilot: guía para agentes

## Stack

El proyecto es un monorepo con tres partes:

- `frontend/`: Next.js 14 con App Router, TypeScript, Tailwind CSS y Framer Motion. El lector usa pdfjs/react-pdf; los editores usan Tiptap y CKEditor.
- `backend/`: FastAPI, SQLAlchemy 2 asíncrono, PostgreSQL y Alembic.
- `desktop/`: Electron, que carga la aplicación web desplegada en Vercel. La URL se puede configurar mediante `AUTOPILOT_APP_URL`.

## Ubicación del código

- Rutas y layout: `frontend/src/app/`.
- Componentes y vistas: `frontend/src/components/`.
- Endpoints: `backend/app/api/v1/`.
- Modelos: `backend/app/models/`.
- Migraciones: `backend/alembic/versions/`.

## Diseño

- Mantén el estilo **Liquid Glass**: superficies translúcidas, `backdrop-blur` y bordes sutiles. Reutiliza los componentes y estilos existentes.
- Mantén la interfaz y los mensajes para el usuario en español.
- Con Framer Motion, define siempre `exit` en los elementos que salen de `AnimatePresence` y usa `layoutId` para indicadores compartidos.

## Reglas de trabajo

- Lee el código relacionado, sus llamadas y sus pruebas antes de cambiar nada.
- Haz cambios mínimos y localizados. No borres ni reescribas componentes enteros.
- No modifiques migraciones ya aplicadas. Crea nuevas migraciones con Alembic.


## Mapa de secciones

Las rutas son relativas a `frontend/src/app`; los componentes, a `frontend/src/components`; los endpoints indicados llevan el prefijo `/api/v1` y viven en `backend/app/api/v1`. Los modelos están en `backend/app/models`. Una sección puede compartir modelos y servicios: consultar también sus consumidores antes de editar.

| Sección | Rutas | Componentes y soporte | Endpoints / archivo API | Modelos / persistencia |
|---|---|---|---|---|
| Dashboard | `/` | `app/page.tsx`, `dashboard/*`, `task-list.tsx`, `hooks/use-task-manager.ts`, `lib/dashboard.ts` | `/tasks`, `/courses`, `/grades`, `/schedule`, `/important-dates` (`tasks.py`, `courses.py`, `grades.py`, `schedule.py`, `important_dates.py`) | `Task`, `Course`, `Grade`, `ScheduleBlock`, `ImportantDate` |
| Planificador | `/planner`, `/calendar` | `planner-page-view.tsx` → carga diferida de `planner-view.tsx`, `lib/planner.ts`, `lib/task-store.ts` | `/schedule`, `/tasks`, `/timetable`, `/classes/{id}/events`, `/grades`, `/important-dates` | `ScheduleBlock`, `Task`, `TimetableEntry`, `ClassEvent`, `Grade`, `ImportantDate` |
| Horario | `/schedule` (abre herramientas del planificador) | `planner-view.tsx`, `weekly-timetable.tsx`, `lib/custom-timetable.ts` | `/timetable` e importación (`timetable.py`) | `TimetableEntry`, `Document`; horario personalizado local |
| Académico | `/academics`; `/subjects` y `/exams` redirigen aquí | `academics-view.tsx`, `exam-dialog.tsx`, `exam-card.tsx`, `lib/grade-events.ts` | `/courses`, `/grades`, `/important-dates` | `Course`, `Grade`, `ImportantDate` |
| Clases entre alumnos | `/classes`, `/classes/[id]` | `class-detail-view.tsx` (lazy), `class/*`, `lib/class-cache.ts` | `/classes` (`classes.py`, `classwork.py`), `/files`, `/notebooks`, WebSocket | `SharedClass`, `ClassMembership`, `ClassMessage`, `ClassEvent`, `ClassAssignment`, `ClassAssignmentCompletion`, `ClassTopic`, `ClassWorkFile`, `ClassAssignmentAttachment`, `ClassWorkComment` |
| Chat | `/chat` | `chat-page-view.tsx`, `chat-view.tsx`, `chat-*-picker.tsx`, `chat-forward-modal.tsx`, `realtime-provider.tsx` | `/chat/*` (`chat.py`), `/ws` (`realtime.py`) | `ChatConversation`, `ChatMember`, `ChatMessage`, `User` |
| Repaso | `/review` | `app/review/page.tsx`, `review/*` | `/flashcards`, `/quizzes` (`learning.py`), `/notebooks/{id}/chat` (`notebooks.py`) | `Flashcard`, `Quiz`, `NotebookMessage`, `NotebookAction` |
| Cuadernos | `/notebooks` y pestaña de Documentos | `app/notebooks/page.tsx`, `notebook-chat.tsx`, `add-to-notebook.tsx` | `/notebooks/*` (`notebooks.py`), `/books`, `/files` | `Notebook`, `NotebookSource`, `NotebookMessage`, `NotebookAction`, `Book`, `Document` |
| Biblioteca y lector | `/library`, `/library/[id]` | `library-view.tsx`, carga dinámica de `book-reader-view.tsx`, `lib/local-library.ts`, `lib/reader-highlights.ts`, `library/pdf-reader.css` | El lector PDF actual usa IndexedDB. `/books/*` (`books.py`) sigue existiendo para libros del servidor y fuentes de cuadernos | `LocalBook` y PDF en IndexedDB/localforage; marcas locales. `Book`, `BookSection`, `BookMessage`, `Document` en el flujo servidor |
| Documentos y archivos | `/documents`, `/files` | `documents-view.tsx` integra cuadernos, Office, calculadora y `canvas/canvas-view.tsx` dinámico; `canvas/*` | `/files`, `/files/uploads`, `/notebooks` (`files.py`, `uploads.py`, `notebooks.py`) | `Document`, `UploadSession`, `Notebook`; pizarras locales |
| Academic Office | `/office`, `/office/[id]`; integrado también en Documentos | `office/office-home.tsx`, `office/office-library.tsx`, `academic-office-view.tsx`, `office/writer-editor.tsx`, `office/sheet-editor.tsx`, `office/use-office-storage.ts`, `lib/office-*` | `/office/documents/*` (`office.py`) | `OfficeDocument`, `OfficeDocumentVersion`; borradores locales por usuario/documento |
| IA | `/studio` y modos `chat`, `audio`, `document`; `/assistant` → chat; `/transcribe` → audio | `studio-page-view.tsx`, `ia-studio.tsx`, `studio/*`, `lib/ai-drawer.ts`; IA contextual de libros/cuadernos | `/assistant/*` incluido `/confirm`, `/studio/*`, `/transcribe`, `/books/{id}/ask`, `/notebooks/{id}/chat` | `AssistantMessage`, `AiOutput`, `Document`, `BookMessage`, `NotebookMessage`, `NotebookAction`; servicios `ai_service.py`, `ai_tools.py`, `notebook_ai.py` |
| Enfoque | `/focus` | `app/focus/page.tsx`, `daily-focus.tsx`, `focus/ambient-player.tsx`, `lib/gamification.ts` | `/focus/*` (`focus.py`), `/tasks` | `FocusSession`, `Task`; preferencias, audio y recompensas locales |
| Spotify | `/spotify` | `spotify-view.tsx`, `lib/spotify.ts`, `lib/spotify-player.ts`, `desktop/main.js` y `preload.js` para OAuth | Spotify Web API y SDK externos, sin router Spotify propio en FastAPI | Tokens y configuración locales; no modelo Spotify propio |
| Ajustes y sesión | `/settings`, `/login` | `settings-view.tsx`, `settings/*`, `auth-provider.tsx`, `preferences-provider.tsx`, `password-recovery.tsx` | `/auth/*`, `/integrations/*`, `/sync/*`, `/reminders`, `/assistant/profile` | `User`, `Integration`, `SyncLog`, `ReminderSettings`; preferencias y caché locales |

## Reglas de edición y zonas delicadas

- Antes de editar, anuncia los archivos concretos que vas a tocar y por qué. Limita los cambios a esos archivos. Si aparece un archivo necesario adicional, anuncia la ampliación antes de modificarlo.
- No reescribas archivos enteros ni mezcles una extracción de componentes con cambios de comportamiento. Extrae una responsabilidad por paso conservando contratos, props, estado y efectos.
- Si un cambio afecta a otra sección, explica esa relación antes de tocarla. `lib/api.ts`, `lib/types.ts`, providers, navegación y CSS global son compartidos.
- Autenticación y privacidad: revisar permisos del backend, aislamiento por usuario/clase, JWT, recuperación y claves de caché. La app es solo para alumnos, sin vista de profesor.
- Tiempo real: preservar eventos REST/WS, reconexión, estados optimistas, mensajes fijados y respuestas. Revisar `chat.py`, `classes.py`, `classwork.py` y ambos servicios/providers realtime conjuntamente.
- Persistencia: no alterar migraciones aplicadas. Cuidar restauraciones, revisiones optimistas, borradores, guardados diferidos y cierres de Office. El lector local y el backend `/books` son almacenes distintos.
- IA: preservar confirmaciones, límites de herramientas, permisos, citas y el resultado real de las acciones; no sustituir escrituras reales por mensajes de éxito.
- Editor/lector: preservar selección, deshacer, composición de texto, carga diferida, workers PDF y paridad de sus versiones. No confundir el editor Tiptap candidato a legado con CKEditor activo.
- Estilos y móvil: revisar `app-shell.tsx`, `navigation.ts`, navegación móvil, tamaños y estados vacíos al mover componentes. Los layouts guardados de `EditablePanels` tienen identificadores persistentes.
- Desktop: IPC de archivos, origen de confianza, OAuth y actualizaciones requieren comprobar navegador y Electron. No tocar el workflow de release durante una limpieza que no sea de despliegue.
- En tareas de limpieza, el inventario es evidencia para revisar, no autorización para eliminar código o dependencias.

<!-- CODEGRAPH_START -->
## CodeGraph

Si existe `.codegraph/` en la raíz del repositorio, usar `codegraph_explore` o `codegraph explore "pregunta o símbolos"` antes de grep/find o leer código para localizar o entender símbolos. Si no existe, omitir CodeGraph; indexar es decisión del usuario.
<!-- CODEGRAPH_END -->

## Red de seguridad

- `frontend/`: `npm run typecheck`, `npm run lint`, `npm run test:smoke`. El smoke inicia servidores propios en puertos 8000 y 3000, exige la API SQLite aislada y crea solo usuarios temporales; requiere Python con `backend/requirements.txt` y Chrome instalado o Chromium de Playwright.
- Chromium de CI: `npm exec --no -- playwright-core install --with-deps chromium`; ejecutar con `SMOKE_BROWSER_CHANNEL=chromium`. No añade una dependencia npm nueva.
- CI construye el frontend con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` y usa `SMOKE_WEB_MODE=start`; localmente el smoke usa `next dev` por defecto. `SMOKE_PYTHON` permite indicar el intérprete.
- Con servidores aislados ya arrancados: `npm run test:smoke -- --no-start`. No usar contra producción. Los informes y capturas de fallo se guardan en un directorio temporal anunciado al acabar/fallar o en `SMOKE_OUTPUT`.
- `backend/`: `python -m pytest tests -q`. CI ejecuta estas comprobaciones en cada push y pull request. El smoke cubre apertura de rutas y PDF local, no sustituye pruebas de interacción, proveedores externos, permisos o concurrencia.

## Cierre

- Ejecuta `npm run typecheck` y `npm run lint` en `frontend/`; informa de cualquier fallo o comprobación que no pueda ejecutarse. Ejecuta también las pruebas pertinentes al cambio.
- Resume los archivos tocados y el resultado de las verificaciones.
- Para desplegar cambios funcionales, actualiza la versión y las notas, crea el commit y el tag y haz push. Sincroniza `frontend/package.json`, `frontend/package-lock.json`, `desktop/package.json`, `desktop/package-lock.json` y `frontend/public/version.json`. Comprueba el resultado del workflow de release. Respeta cualquier instrucción explícita del usuario sobre el despliegue y el alcance de la tarea.
