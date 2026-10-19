# Arquitectura

## 1. Vision general

Academic Autopilot es un **monorepo** con dos aplicaciones desacopladas que se comunican por HTTP/JSON:

- **`backend/`** — API REST en FastAPI. Contiene los conectores a Moodle/Classroom, el motor de
  planificacion y un worker en background que sincroniza periodicamente.
- **`frontend/`** — SPA en Next.js que consume la API. Renderiza el dashboard, el modo enfoque y los
  ajustes de integraciones.

No hay acoplamiento de runtime: el frontend solo conoce `NEXT_PUBLIC_API_URL`.

```
┌──────────────────────────────────────────────────────────────────────┐
│                            Usuario (navegador)                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS / REST (JWT Bearer)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Next.js (frontend)                            │
│  /            Dashboard   /focus  Modo enfoque   /settings  Ajustes   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ fetch  (lib/api.ts)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       FastAPI (backend)                               │
│                                                                       │
│  API v1 ── deps ── Auth (JWT)                                         │
│   ├── /auth          registro/login                                   │
│   ├── /integrations  tokens Moodle + OAuth Google                     │
│   ├── /sync          dispara sincronizacion                           │
│   ├── /tasks         CRUD + /tasks/optimized                          │
│   ├── /schedule      bloques de disponibilidad + plan                 │
│   ├── /courses       asignaturas (manuales)                           │
│   ├── /grades        notas + /grades/summary (media ponderada)        │
│   ├── /timetable     horario semanal                                  │
│   ├── /files         documentos + subida por trozos (20 GB)           │
│   ├── /classes       clases compartidas: chat, calendario y archivos  │
│   ├── /assistant     chat con IA (Ollama)                             │
│   ├── /studio        resumenes e infografias en PDF                   │
│   └── /ws            WebSocket de sincronizacion en tiempo real       │
│                                                                       │
│  Services                                  Connectors                    │
│   ├── sync_service / planner.py            ├── moodle.py                 │
│   ├── ai_service / ai_tools / realtime     └── classroom.py              │
│   ├── ai_studio_service / pdf_service                                   │
│   ├── upload_service / class_service                                    │
│   └── scheduler.py (APScheduler) en el worker                           │
│                                                                       │
│  SQLAlchemy 2.0 (async, asyncpg)                                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   PostgreSQL 16  │
                       └──────────────────┘
```

## 2. Decisiones de arquitectura

| Decision | Alternativa descartada | Motivo |
|----------|------------------------|--------|
| SQLAlchemy 2.0 + Alembic | Prisma ORM | Prisma en Python es no-oficial y obliga a Node en el backend. SQLAlchemy es el estandar idiomatico y async-native. |
| APScheduler embebido | Celery + Redis | Para una carga de 1 sync/usuario cada N min no se justifica un broker. APScheduler corre en el mismo proceso `worker`. Se puede migrar a Celery sin tocar la logica de negocio. |
| JWT stateless | Sesiones en servidor | Simplifica el despliegue y encaja con el patron SPA → API. |
| Tokens de integracion cifrados en BD | Variables de entorno globales | Cada usuario conecta *su* Moodle/Google. El secreto se cifra con `Fernet` (clave derivada de `SECRET_KEY`). |
| Conectores con interfaz comun (`BaseConnector`) | Codigo ad-hoc por plataforma | Permite anadir nuevas plataformas (Canvas, Blackboard) sin tocar el `sync_service`. |

## 3. Flujo de sincronizacion

```
 Trigger (scheduler cada N min  o  POST /sync)
        │
        ▼
 sync_service.run_sync(user)
        │
        ├─ 1. Cargar integraciones activas del usuario (Moodle / Google)
        ├─ 2. Por cada integracion -> connector.fetch_courses() / fetch_tasks()
        ├─ 3. Normalizar cada item a un DTO comun  (NormalizedTask)
        ├─ 4. Upsert por clave (source, external_id):
        │        · nuevo        -> INSERT
        │        · ya existe    -> UPDATE si cambio (titulo/fecha/estado)
        │        · completado    -> marcar status=completed (o ignorar segun config)
        ├─ 5. Detectar tareas locales huerfanas (borradas en origen) -> status=archived
        ├─ 6. Ejecutar planner.optimize(user) para recolocar bloques
        └─ 7. Registrar resultado en SyncLog (metricas + errores)
```

**Manejo de errores:** cada conector esta envuelto en `try/except`; un fallo de Moodle **no** impide
sincronizar Google. Los errores se acumulan y se guardan en `SyncLog.errors` sin abortar el job.

## 4. Motor de planificacion

Entrada: tareas pendientes + bloques de disponibilidad semanales (`ScheduleBlock`).

1. **Priorizacion** — cada tarea recibe una prioridad efectiva:
   - `URGENT` si `due_at - now <= 72h`
   - `LONG_PROJECT` si `estimated_minutes >= 240`
   - `SHORT_TASK` en el resto.
2. **Deadline efectivo** — `effective_due = due_at - SAFETY_MARGIN (24h)`.
3. **Troceado** — toda tarea mayor a `MAX_SESSION_MINUTES` (90 min) se divide en subtareas de
   sesiones de 45–90 min, con `parent_task_id` apuntando al padre.
4. **Empaquetado (greedy por prioridad)** — las subtareas se ordenan por (`effective_due`, prioridad)
   y se colocan en el primer hueco libre que quepa, respetando:
   - no programar en el pasado,
   - no superar `effective_due`,
   - no solapar bloques del usuario.
5. **Persistencia** — cada sesion recibe `target_start_at` / `target_end_at`. El dashboard diario
   solo lee las sesiones cuyo `target_start_at` cae en el dia actual.

## 5. Seguridad

- Contrasenas con `bcrypt` (passlib).
- JWT firmados con HS256 (`SECRET_KEY`).
- Tokens de Moodle/Google cifrados con `Fernet` antes de persistirse.
- CORS restringido a `CORS_ORIGINS` + `CORS_ORIGIN_REGEX` (por defecto permisivo
  para funcionar en LAN/tunel; restringir en produccion).
- Rate limiting por IP con `slowapi` (endpoints de auth).
- El WebSocket se autentica con el JWT por query string (`?token=`), ya que el
  navegador no envia cabeceras en el handshake.

## 6. IA Studio y asistente (Ollama local)

Ambos usan un endpoint **compatible con OpenAI** (`AI_BASE_URL`, por defecto
`http://host.docker.internal:11434/v1`) para poder usar Ollama sin clave o
cualquier proveedor en la nube.

- **Asistente** (`ai_service`): construye contexto del usuario (tareas, agenda)
  y responde en lenguaje natural; si el modelo no esta disponible, cae a un motor
  heurístico (`source="heuristic"`).
- **IA Studio** (`ai_studio_service`): extrae texto del documento (`pypdf`,
  `python-docx`, o texto plano), pide al modelo un JSON estructurado
  (`{title, summary, key_points, ...}` / `{sections, stats, ...}`) y renderiza un
  PDF con `reportlab` (`pdf_service`). El PDF se guarda como un `Document` y se
  registra en `ai_outputs`. Texto saneado a Latin-1 (WinAnsi) para las fuentes
  estandar de reportlab.

## 7. Sincronizacion en tiempo real

`services/realtime.py` mantiene un `ConnectionManager` con las colas de cada
usuario conectado. Cada endpoint de mutacion (tareas, notas, horario, cursos,
archivos, studio, schedule, assistant) llama a `notify(user_id, event, data)`
tras el commit. Los clientes conectados a `/api/v1/ws` reciben los eventos y las
paginas de React refrescan sus datos. El frontend resuelve la URL de la API y del
WebSocket en tiempo de ejecucion, de modo que funciona igual en localhost, LAN o
tras un tunel (proxy Caddy en un unico origen).

## 8. Escalabilidad futura

- Sustituir APScheduler por Celery + Redis si el numero de usuarios crece.
- Cache de respuestas de conector en Redis (TTL corto) para evitar rate limits.
- Extraer el planner a un servicio aparte (ya es una funcion pura, sin I/O).
