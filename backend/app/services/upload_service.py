"""Utilidades de subidas por trozos: rutas, limites y limpieza de sesiones."""
from __future__ import annotations

import os
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.upload_session import UploadSession

logger = get_logger(__name__)


def max_upload_bytes() -> int:
    """Limite por archivo (bytes) segun configuracion."""
    return settings.max_upload_mb * 1024 * 1024


def chunk_size_bytes() -> int:
    """Tamano de cada trozo de subida (bytes)."""
    return settings.upload_chunk_mb * 1024 * 1024


def part_path(session: UploadSession) -> str:
    """Ruta absoluta del fichero temporal (.part) de una sesion."""
    return os.path.join(settings.files_dir, session.storage_path + ".part")


def final_path(session: UploadSession) -> str:
    """Ruta absoluta final del archivo de una sesion."""
    return os.path.join(settings.files_dir, session.storage_path)


def build_storage_path(
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    class_id: uuid.UUID | None,
    document_id: uuid.UUID,
    extension: str,
) -> str:
    """Ruta relativa de almacenamiento (misma estructura que /files)."""
    if class_id is not None:
        folder = f"class-{class_id}"
    elif course_id is not None:
        folder = str(course_id)
    else:
        folder = "general"
    stored_name = f"{document_id}.{extension}" if extension else str(document_id)
    return os.path.join(str(user_id), folder, stored_name)


def remove_file_quietly(path: str) -> None:
    """Borra un fichero sin fallar si ya no existe."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as exc:  # pragma: no cover - best effort
        logger.warning("No se pudo borrar %s: %s", path, exc)


async def purge_stale_sessions(db: AsyncSession) -> int:
    """Elimina sesiones de subida antiguas (a medias, abortadas o completadas).

    Las completadas solo se conservan un tiempo para poder responder de forma
    idempotente a reintentos de `complete`; luego se limpian.
    """
    cutoff = utcnow() - timedelta(hours=settings.upload_session_ttl_hours)
    result = await db.execute(
        select(UploadSession).where(UploadSession.updated_at < cutoff)
    )
    sessions = list(result.scalars().all())
    if not sessions:
        return 0
    for session in sessions:
        if session.status in ("pending", "aborted"):
            remove_file_quietly(part_path(session))
        await db.delete(session)
    await db.commit()
    logger.info("Sesiones de subida antiguas eliminadas: %d", len(sessions))
    return len(sessions)
