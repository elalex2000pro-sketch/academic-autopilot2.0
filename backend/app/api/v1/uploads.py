"""Subidas por trozos: crear sesion, enviar trozos, completar y abortar.

Pensado para archivos grandes (hasta MAX_UPLOAD_MB; por defecto 20 GB): el
navegador divide el archivo en trozos de `chunk_size` bytes y los envia en
peticiones cortas. Si una peticion se corta a medias, la subida se reanuda
desde el ultimo trozo confirmado (`received_bytes`), asi que un archivo de
20 GB no depende de una unica peticion larga que el proxy pueda cortar.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.models.course import Course
from app.models.document import Document
from app.models.shared_class import ClassMembership
from app.models.upload_session import UploadSession
from app.schemas.file import DocumentRead
from app.schemas.upload import ChunkRead, UploadCreate, UploadRead
from app.services import class_service, upload_service
from app.services.realtime import notify

logger = get_logger(__name__)

router = APIRouter(prefix="/files/uploads", tags=["files"])


@router.post("", response_model=UploadRead, status_code=status.HTTP_201_CREATED)
async def create_upload(
    payload: UploadCreate, current_user: CurrentUser, db: DbSession
) -> UploadSession:
    """Crea una sesion de subida y devuelve el tamano de trozo a usar."""
    await upload_service.purge_stale_sessions(db)

    original = Path(payload.filename).name
    extension = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(sorted(settings.allowed_extensions))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extension no permitida. Permitidas: {allowed}",
        )

    if payload.size_bytes > upload_service.max_upload_bytes():
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera el limite de {settings.max_upload_mb} MB",
        )

    if payload.course_id is not None:
        course = await db.execute(
            select(Course.id).where(
                Course.id == payload.course_id, Course.user_id == current_user.id
            )
        )
        if course.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Asignatura no encontrada"
            )

    if payload.class_id is not None:
        membership = await db.execute(
            select(ClassMembership.id).where(
                ClassMembership.class_id == payload.class_id,
                ClassMembership.user_id == current_user.id,
            )
        )
        if membership.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No eres miembro de esta clase",
            )

    document_id = uuid.uuid4()
    storage_path = upload_service.build_storage_path(
        current_user.id,
        payload.course_id,
        payload.class_id,
        document_id,
        extension,
    )
    session = UploadSession(
        user_id=current_user.id,
        course_id=payload.course_id,
        class_id=payload.class_id,
        filename=original,
        content_type=payload.content_type or "application/octet-stream",
        size_bytes=payload.size_bytes,
        received_bytes=0,
        chunk_size=upload_service.chunk_size_bytes(),
        status="pending",
        storage_path=storage_path,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{upload_id}", response_model=UploadRead)
async def upload_status(
    upload_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> UploadSession:
    """Estado actual de una subida (para reanudarla desde el ultimo trozo)."""
    return await _get_own_session(db, current_user.id, upload_id)


@router.put("/{upload_id}/chunk", response_model=ChunkRead)
async def upload_chunk(
    upload_id: uuid.UUID,
    request: Request,
    index: int,
    current_user: CurrentUser,
    db: DbSession,
) -> ChunkRead:
    """Recibe un trozo del archivo (cuerpo binario) y lo agrega al .part."""
    session = await _get_own_session(db, current_user.id, upload_id)
    if session.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La subida ya no esta activa",
        )

    chunk_size = session.chunk_size
    expected_offset = session.received_bytes
    expected_index = expected_offset // chunk_size
    if index != expected_index:
        # Reintento duplicado o trozo fuera de orden: el cliente se reajusta.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Indice de trozo fuera de orden",
                "expected_index": expected_index,
                "received_bytes": expected_offset,
            },
        )

    expected_len = min(chunk_size, session.size_bytes - expected_offset)
    path = upload_service.part_path(session)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "wb"):
            pass

    written = 0
    try:
        with open(path, "r+b") as handle:
            # Se escribe en la posicion esperada: si un intento anterior quedo a
            # medias, este lo sobreescribe sin corromper el archivo.
            handle.seek(expected_offset)
            async for data in request.stream():
                written += len(data)
                if (
                    written > expected_len
                    or expected_offset + written > upload_service.max_upload_bytes()
                ):
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="El trozo supera el tamano permitido",
                    )
                handle.write(data)
    except HTTPException:
        raise
    except OSError as exc:
        logger.error("No se pudo escribir el trozo de %s: %s", upload_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo escribir el archivo",
        ) from exc

    if written != expected_len:
        # Conexion cortada a mitad de trozo: no confirmamos bytes.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Trozo incompleto; reintenta el mismo indice",
                "expected_bytes": expected_len,
                "received_bytes": expected_offset,
            },
        )

    session.received_bytes = expected_offset + written
    await db.commit()
    return ChunkRead(
        received_bytes=session.received_bytes,
        next_index=expected_index + 1,
        chunk_size=chunk_size,
    )


@router.post(
    "/{upload_id}/complete",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def complete_upload(
    upload_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Document:
    """Cierra la subida: renombra el .part y crea el Document definitivo."""
    session = await _get_own_session(db, current_user.id, upload_id)

    # Idempotente: si ya se completo, devuelve el documento creado.
    if session.status == "completed" and session.document_id is not None:
        document = await db.get(Document, session.document_id)
        if document is not None:
            return document

    if session.received_bytes != session.size_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Faltan trozos por subir",
                "received_bytes": session.received_bytes,
                "size_bytes": session.size_bytes,
            },
        )

    part = upload_service.part_path(session)
    final = upload_service.final_path(session)
    try:
        if os.path.exists(part):
            with open(part, "r+b") as handle:
                # Recorta cualquier resto de intentos fallidos y asegura en disco.
                handle.truncate(session.size_bytes)
                handle.flush()
                os.fsync(handle.fileno())
            os.makedirs(os.path.dirname(final), exist_ok=True)
            os.replace(part, final)
        elif not os.path.exists(final):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La subida no tiene datos en disco",
            )
    except HTTPException:
        raise
    except OSError as exc:
        logger.error("No se pudo finalizar la subida %s: %s", upload_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo finalizar la subida",
        ) from exc

    document = Document(
        user_id=current_user.id,
        course_id=session.course_id,
        class_id=session.class_id,
        filename=session.filename,
        content_type=session.content_type or "application/octet-stream",
        size_bytes=session.size_bytes,
        storage_path=session.storage_path,
    )
    db.add(document)
    session.status = "completed"
    await db.flush()
    session.document_id = document.id
    await db.commit()
    await db.refresh(document)

    logger.info(
        "Subida completada: %s (%d bytes) para %s",
        document.filename,
        document.size_bytes,
        current_user.email,
    )
    notify(current_user.id, "files", {"action": "created", "id": str(document.id)})
    if session.class_id is not None:
        await class_service.notify_class(
            db, session.class_id, "file", id=str(document.id)
        )
    return document


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def abort_upload(
    upload_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Cancela una subida y borra los datos temporales."""
    session = await _get_own_session(db, current_user.id, upload_id)
    if session.status == "pending":
        upload_service.remove_file_quietly(upload_service.part_path(session))
    await db.delete(session)
    await db.commit()


async def _get_own_session(
    db: DbSession, user_id: uuid.UUID, upload_id: uuid.UUID
) -> UploadSession:
    result = await db.execute(
        select(UploadSession).where(
            UploadSession.id == upload_id, UploadSession.user_id == user_id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subida no encontrada"
        )
    return session
