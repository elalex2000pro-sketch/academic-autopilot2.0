"""Worker en background: sincronizacion periodica via APScheduler."""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.services.sync_service import sync_all_users
from app.services.upload_service import purge_stale_sessions

logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _run_sync_job() -> None:
    """Job periodico: sincroniza a todos los usuarios con integraciones."""
    logger.info("Iniciando sincronizacion automatica programada...")
    async with AsyncSessionLocal() as session:
        try:
            await sync_all_users(session)
        except Exception as exc:  # noqa: BLE001 - el worker nunca debe caer
            logger.exception("Fallo el job de sincronizacion: %s", exc)
    logger.info("Sincronizacion automatica finalizada.")


async def _run_cleanup_job() -> None:
    """Job periodico: limpia subidas a medias abandonadas."""
    async with AsyncSessionLocal() as session:
        try:
            await purge_stale_sessions(session)
        except Exception as exc:  # noqa: BLE001 - el worker nunca debe caer
            logger.exception("Fallo la limpieza de subidas: %s", exc)


def start_scheduler() -> AsyncIOScheduler | None:
    """Arranca el scheduler si esta habilitado. Idempotente."""
    global _scheduler
    if not settings.enable_scheduler:
        logger.info("Scheduler deshabilitado (ENABLE_SCHEDULER=false).")
        return None
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_sync_job,
        trigger=IntervalTrigger(minutes=settings.sync_interval_minutes),
        id="sync_all_users",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.add_job(
        _run_cleanup_job,
        trigger=IntervalTrigger(hours=6),
        id="cleanup_uploads",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler iniciado: sync cada %d minutos.", settings.sync_interval_minutes
    )
    return _scheduler


def stop_scheduler() -> None:
    """Detiene el scheduler si esta activo."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler detenido.")
