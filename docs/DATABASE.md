# Esquema de Base de Datos

Motor: **PostgreSQL 16**. Gestado con SQLAlchemy 2.0 y migrado con Alembic.

## Diagrama relacional (ER)

```
┌───────────────────────────┐
│           User            │
├───────────────────────────┤
│ id            UUID  PK     │
│ email    VARCHAR(320) UNIQ │
│ hashed_password TEXT       │
│ full_name     TEXT         │
│ timezone      TEXT         │
│ created_at    TIMESTAMPTZ  │
│ updated_at    TIMESTAMPTZ  │
└─────┬─────────┬───────┬───────┬──────────┐
      │1        │1      │1      │1         │1
      │         │       │       │          │
      │N        │N      │N      │N         │N
┌─────▼─────┐ ┌─▼────────┐ ┌───▼────────┐ ┌▼───────────────┐ ┌▼────────────┐
│Integration│ │  Course  │ │    Task    │ │ ScheduleBlock  │ │  SyncLog    │
├───────────┤ ├──────────┤ ├────────────┤ ├────────────────┤ ├─────────────┤
│ id     PK │ │ id    PK │ │ id      PK │ │ id          PK │ │ id       PK │
│ user_id FK│ │ user_id  │ │ user_id  FK│ │ user_id      FK│ │ user_id  FK │
│ provider  │ │ source   │ │ course_id  │ │ day_of_week    │ │ provider    │
│ status    │ │ ext_id   │ │  FK (nul)  │ │  (0=Lun..6)    │ │ status      │
│ base_url  │ │ name     │ │ source     │ │ start_time     │ │ started_at  │
│ token_enc │ │ code     │ │ ext_id     │ │ end_time       │ │ finished_at │
│ refresh_  │ │ color    │ │ title      │ │ label          │ │ created     │
│  token_enc│ │ UNIQUE(  │ │ description│ │ is_active      │ │ updated     │
│ expires_at│ │  user_id,│ │ due_at     │ │ created_at     │ │ removed     │
│ meta JSON │ │  source, │ │ est_minutes│ └────────────────┘ │ errors JSON │
│ created_at│ │  ext_id) │ │ priority   │                    │ message     │
└───────────┘ └──────────┘ │ status     │                    └─────────────┘
                           │ target_    │   ┌──────────────────────────┐
                           │  start_at  │   │  Relacion reflexiva       │
                           │ target_    │   │  Task.parent_task_id ->   │
                           │  end_at    │   │  Task.id  (subtareas)     │
                           │ parent_task│◄──┘                          │
                           │  _id  FK   │                              │
                           │ created_at │                              │
                           │ updated_at │                              │
                           │ UNIQUE(    │                              │
                           │  user_id,  │                              │
                           │  source,   │                              │
                           │  ext_id)   │                              │
                           └────────────┘
```

## Detalle de tablas

### `User`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `email` | VARCHAR(320) | Unico, case-insensitive |
| `hashed_password` | TEXT | bcrypt |
| `full_name` | TEXT | |
| `timezone` | TEXT | IANA, ej. `America/Mexico_City` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `Integration` *(tabla de apoyo, no en el brief pero necesaria)*
Almacena las credenciales por usuario. Los secretos van cifrados (`*_enc`).
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User (on delete cascade) |
| `provider` | ENUM | `moodle` / `google_classroom` |
| `status` | ENUM | `connected` / `error` / `disabled` |
| `base_url` | TEXT | URL de Moodle (solo provider=moodle) |
| `token_enc` | TEXT | Token de Moodle o access_token de Google, cifrado |
| `refresh_token_enc` | TEXT | Solo Google |
| `expires_at` | TIMESTAMPTZ | Solo Google |
| `meta` | JSONB | `site_info`, email de Google, etc. |
| `UNIQUE(user_id, provider)` | | |

### `Course`
Asignatura, normalizada entre plataformas.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `source` | ENUM | plataforma de origen |
| `external_id` | TEXT | id del curso en Moodle/Google |
| `name` | TEXT | |
| `code` | TEXT | codigo corto |
| `color` | TEXT | hex para la UI |
| `UNIQUE(user_id, source, external_id)` | | Idempotencia del upsert |

### `Task`
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `course_id` | UUID | FK → Course (nullable) |
| `source` | ENUM | `moodle` / `google_classroom` / `manual` |
| `external_id` | TEXT | id remoto; `manual-<uuid>` si es local |
| `title` / `description` | TEXT | |
| `due_at` | TIMESTAMPTZ | fecha limite real |
| `estimated_minutes` | INT | estimacion de esfuerzo |
| `priority` | ENUM | `urgent` / `long_project` / `short_task` |
| `status` | ENUM | `pending` / `in_progress` / `completed` / `archived` |
| `target_start_at` / `target_end_at` | TIMESTAMPTZ | bloque asignado por el planner |
| `parent_task_id` | UUID | FK → Task (subtareas) |
| `UNIQUE(user_id, source, external_id)` | | Idempotencia del upsert |

### `ScheduleBlock`
Plantilla semanal de disponibilidad. Ej. las tardes de 16:30 a 20:30.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `day_of_week` | INT | 0=Lunes … 6=Domingo |
| `start_time` / `end_time` | TIME | hora local del usuario |
| `label` | TEXT | ej. "Tarde de estudio" |
| `is_active` | BOOL | |

### `SyncLog`
Auditoria de cada sincronizacion.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `provider` | ENUM | `moodle` / `google_classroom` / `all` |
| `status` | ENUM | `success` / `partial` / `error` |
| `started_at` / `finished_at` | TIMESTAMPTZ | |
| `created` / `updated` / `removed` | INT | contadores |
| `message` | TEXT | resumen |
| `errors` | JSONB | lista de errores por conector |

## Tablas de clases compartidas y subidas (v0.7)

Estas tablas llegan con las **clases compartidas** (codigo permanente, chat,
calendario y archivos en comun) y la **subida por trozos** (hasta 20 GB).

### `SharedClass`
Clase compartida: un grupo con **codigo permanente** de union.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `name` / `description` | TEXT | |
| `code` | VARCHAR(12) | Unico (`ix_shared_classes_code`), sin caracteres confundibles |
| `owner_id` | UUID | FK → User (on delete cascade) |

### `ClassMembership`
Union de un usuario a una clase (permanente hasta que salga).
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `class_id` | UUID | FK → SharedClass (cascade) |
| `user_id` | UUID | FK → User (cascade) |
| `role` | VARCHAR(16) | `owner` / `member` |
| `UNIQUE(class_id, user_id)` | | |

### `ClassMessage`
Mensajes del chat de la clase; los anuncios del propietario se pueden fijar.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `class_id` | UUID | FK → SharedClass (cascade) |
| `user_id` | UUID | FK → User (cascade) |
| `content` | TEXT | |
| `kind` | VARCHAR(16) | `message` / `announcement` |
| `pinned` | BOOL | los anuncios se fijan arriba |

### `ClassEvent`
Calendario conjunto de la clase.
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `class_id` | UUID | FK → SharedClass (cascade) |
| `created_by` | UUID | FK → User (cascade) |
| `title` / `description` / `location` | TEXT | |
| `start_at` / `end_at` | TIMESTAMPTZ | fin opcional |
| `all_day` | BOOL | reservado |

### `UploadSession`
Subida por trozos reanudable (`MAX_UPLOAD_MB=20480` → 20 GB por archivo).
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User (cascade) |
| `course_id` / `class_id` | UUID | destino opcional (FK, `SET NULL`) |
| `document_id` | UUID | FK → Document; se rellena al completar |
| `filename` / `content_type` | VARCHAR | |
| `size_bytes` / `received_bytes` | BIGINT | total y ya subido |
| `chunk_size` | INT | 25 MB por defecto (`UPLOAD_CHUNK_MB`) |
| `status` | VARCHAR(16) | `pending` / `completed` / `aborted` |
| `storage_path` | VARCHAR(1000) | ruta del `.part` en `FILES_DIR` |

> Las subidas sin terminar se limpian solas a las `UPLOAD_SESSION_TTL_HOURS`
> horas (48 por defecto): al crear una subida nueva y con un job cada 6 h.

Tambien `Document` gana `class_id` (FK → SharedClass, `ON DELETE SET NULL`):
un documento puede pertenecer a una asignatura o a una clase compartida.

## Indices clave

```sql
CREATE INDEX ix_task_user_status       ON tasks (user_id, status);
CREATE INDEX ix_task_user_target_start ON tasks (user_id, target_start_at);
CREATE INDEX ix_task_due_at            ON tasks (due_at);
CREATE INDEX ix_synclog_user_started   ON sync_logs (user_id, started_at DESC);
CREATE INDEX ix_schedule_user_day      ON schedule_blocks (user_id, day_of_week);
CREATE INDEX ix_class_memberships_user ON class_memberships (user_id);
CREATE INDEX ix_class_messages_class   ON class_messages (class_id);
CREATE INDEX ix_class_events_class     ON class_events (class_id);
CREATE INDEX ix_upload_sessions_user   ON upload_sessions (user_id);
```

## Enums (PostgreSQL nativos)

- `source_platform`: `moodle`, `google_classroom`, `manual`
- `task_priority`: `urgent`, `long_project`, `short_task`
- `task_status`: `pending`, `in_progress`, `completed`, `archived`
- `integration_status`: `connected`, `error`, `disabled`
- `sync_status`: `success`, `partial`, `error`
