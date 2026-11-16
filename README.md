# Atlantium

## Identificadores que no se renombran y por qué

El producto se llama **Atlantium**; **Academic Office** conserva su nombre.
Los nombres técnicos siguientes se mantienen por compatibilidad con las
instalaciones y los datos existentes. No deben sustituirse mediante un cambio
global de texto:

| Identificador conservado | Motivo |
|---|---|
| `academic-autopilot-desktop`; userData/sessionData en `%APPDATA%\academic-autopilot-desktop` (Windows) | Mantener el perfil, la sesión, los ajustes y los borradores existentes. |
| Partición `persist:academic-autopilot` | Conservar cookies, IndexedDB, PDF locales y cachés del escritorio. |
| appId/AUMID `com.academicautopilot.desktop.iconfix1` y GUID NSIS `7D4A2C91-3B6E-4F8A-9C1D-2E5B7A9F4C60` | Mantener la identidad de instalación y actualización. |
| `Academic Autopilot 1310` (executableName) | Conservar el ejecutable y el nombre de carpeta calculado por NSIS. No es el nombre comercial. |
| `Academic-Autopilot-Setup.exe` y `Academic-Autopilot-${version}-mac.${ext}` | Mantener enlaces de descarga y compatibilidad con los manifiestos de actualización. |
| Feed GitHub: owner `elalex2000pro-sketch`, repo `academic-autopilot2.0` | Las instalaciones existentes usan esa dirección, que redirige al repositorio actual `Atlantium`. Conservar también los nombres `latest.yml` y `latest-mac.yml`. |
| `AcademicAutopilotDesktop/<version>`, puente `autopilotDesktop`, nombres de IndexedDB y claves locales `autopilot`/`academic-autopilot` | Son contratos internos, no texto de marca; cambiarlos requiere un plan de compatibilidad. |
| `https://academicautopilot.vercel.app` | Sigue siendo la URL de arranque de instalaciones de escritorio existentes. |

**No quitar ni redirigir `academicautopilot.vercel.app` mientras haya
instalaciones de escritorio que lo carguen.** Debe servir la aplicación
directamente. Un origen distinto tiene su propio almacenamiento: una
redirección no traslada cookies, IndexedDB ni PDF locales.

Las rutas de ejemplo como `academic-autopilot/`, los nombres de servicios y las
URLs técnicas antiguas se conservan. Las notas de versiones, informes y planes
ya ejecutados describen su momento histórico y no se reescriben.

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

## Funciones

- **Panel** con plan diario, **Asignaturas**, **Horario** semanal, **Calendario**, **Examenes** y **Modo Enfoque**.
- **Asistente IA** (chat flotante en toda la app; con reglas si no hay modelo configurado).
- **IA Studio**: resumenes e infografias en PDF a partir de tus apuntes.
- **Archivos** por asignatura, con **subida por trozos reanudable de hasta 20 GB** por archivo.
- **Clases compartidas**: grupo con **codigo permanente**, chat con anuncios, calendario comun
  y archivos compartidos.

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
  `ScheduleBlock`, `SyncLog`, `Integration` y las tablas de clases compartidas y subidas.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — configuracion, variables de entorno y despliegue.
