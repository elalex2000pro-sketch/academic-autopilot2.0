"""Punto de entrada de la API FastAPI."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter
from app.workers.scheduler import start_scheduler, stop_scheduler

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Arranca el scheduler de sincronizacion al iniciar y lo detiene al cerrar."""
    logger.info("Arrancando %s (%s)", settings.app_name, settings.environment)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()
        logger.info("Apagando %s", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Gestor academico autonomo: sincroniza Moodle/Classroom y planifica tu estudio.",
    lifespan=lifespan,
)

# --- Rate limiting ---
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes. Intenta mas tarde."},
    )


# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rutas ---
app.include_router(api_router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    """Healthcheck para Docker/Kubernetes."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "version": app.version,
    }


@app.get("/", tags=["system"])
async def root() -> dict:
    return {"name": settings.app_name, "docs": "/docs", "health": "/health"}
