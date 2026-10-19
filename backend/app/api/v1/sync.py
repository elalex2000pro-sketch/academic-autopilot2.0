"""Endpoints para disparar y consultar la sincronizacion."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import desc, select

from app.api.deps import CurrentUser, DbSession
from app.models.enums import Provider
from app.models.sync_log import SyncLog
from app.schemas.sync import SyncLogRead, SyncRequest, SyncResult
from app.services.sync_service import sync_user

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("", response_model=list[SyncResult])
async def trigger_sync(
    current_user: CurrentUser, db: DbSession, payload: SyncRequest | None = None
) -> list[SyncResult]:
    """Fuerza una sincronizacion inmediata de las integraciones del usuario."""
    provider = payload.provider if payload else Provider.all
    results = await sync_user(db, current_user, provider=provider)
    return [SyncResult(**r) for r in results]


@router.get("/logs", response_model=list[SyncLogRead])
async def sync_logs(current_user: CurrentUser, db: DbSession, limit: int = 20) -> list[SyncLog]:
    """Devuelve las ultimas ejecuciones de sincronizacion."""
    result = await db.execute(
        select(SyncLog)
        .where(SyncLog.user_id == current_user.id)
        .order_by(desc(SyncLog.started_at))
        .limit(min(limit, 100))
    )
    return list(result.scalars().all())


@router.get("/status", response_model=list[SyncLogRead])
async def sync_status(current_user: CurrentUser, db: DbSession) -> list[SyncLog]:
    """Ultima sincronizacion por proveedor (para el indicador en vivo)."""
    result = await db.execute(
        select(SyncLog)
        .where(SyncLog.user_id == current_user.id)
        .order_by(desc(SyncLog.started_at))
        .limit(10)
    )
    logs = list(result.scalars().all())
    seen: set[str] = set()
    latest: list[SyncLog] = []
    for log in logs:
        if log.provider.value in seen:
            continue
        seen.add(log.provider.value)
        latest.append(log)
    return latest
