# Academic Autopilot

Gestor academico autonomo: sincroniza tareas de **Moodle** y **Google Classroom**, las prioriza,
las reparte en tus huecos libres y te muestra un **plan de trabajo diario** con bloques de tiempo
y checklist para eliminar la procrastinacion.

```
+-------------------+        +----------------------+        +------------------+
|  Moodle WS API    |        |   FastAPI Backend    |        |  Next.js Web App |
|  Google Classroom |  --->  |  Sync + Planner + DB |  --->  |  Dashboard/Focus |
+-------------------+        +----------------------+        +------------------+
                                      |
                              +---------------+
                              |  PostgreSQL   |
                              +---------------+
```

## Stack

| Capa            | Tecnologia                                              |
|-----------------|---------------------------------------------------------|
| Frontend        | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/UI |
| Backend         | Python 3.11 + FastAPI + SQLAlchemy 2.0 (async)          |
| Base de datos   | PostgreSQL 16 + Alembic (migraciones)                   |
| Worker          | APScheduler (sync en background)                        |
| Integraciones   | Moodle Web Services (REST) + Google Classroom (OAuth2)  |

> **Nota de arquitectura sobre el ORM:** el brief menciona *Prisma*. En un backend Python/FastAPI,
> Prisma solo existe como cliente no-oficial (`prisma-client-py`) y obliga a tener Node como
> dependencia del backend. Para un stack Python puro y *production-ready* se usa **SQLAlchemy 2.0 +
> Alembic**, que es el equivalente idiomatico (modelos tipados + migraciones versionadas). El esquema
> es practicamente identico. Ver `docs/ARCHITECTURE.md`.

## Estructura

```
academic-autopilot/
├── backend/            # API FastAPI + motor de planificacion + conectores
├── frontend/           # App Next.js (dashboard, modo enfoque, ajustes)
├── docs/               # Arquitectura, esquema de BD y despliegue
├── docker-compose.yml  # postgres + backend + worker + frontend
└── .env.example
```

## Arranque rapido

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs

Guia completa (local sin Docker, OAuth de Google, tokens de Moodle) en
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentacion

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisiones de diseno y flujo de sincronizacion.
- [docs/DATABASE.md](docs/DATABASE.md) — esquema relacional (ER) de `User`, `Course`, `Task`,
  `ScheduleBlock`, `SyncLog`, `Integration`.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — configuracion, variables de entorno y despliegue.
