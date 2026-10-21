"""Endpoints de archivos: subida, listado, descarga y borrado.

Ademas de la subida en una sola peticion (archivos pequenos), existe la
subida por trozos en `/files/uploads` (archivos grandes, reanudable).
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.models.course import Course
from app.models.document import Document
from app.models.shared_class import ClassMembership, SharedClass
from app.schemas.file import DocumentRead
from app.services import class_service
from app.services.realtime import notify

logger = get_logger(__name__)

router = APIRouter(prefix="/files", tags=["files"])

_CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.get("", response_model=list[DocumentRead])
async def list_files(
    current_user: CurrentUser,
    db: DbSession,
    course_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
) -> list[Document]:
    """Lista los documentos del usuario (o los de una clase compartida)."""
    if class_id is not None:
        await _ensure_class_member(db, current_user.id, class_id)
        stmt = select(Document).where(Document.class_id == class_id)
    else:
        stmt = select(Document).where(
            Document.user_id == current_user.id,
            Document.class_id.is_(None),
        )
        if course_id is not None:
            stmt = stmt.where(Document.course_id == course_id)
    stmt = stmt.order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
    course_id: uuid.UUID | None = Form(None),
) -> Document:
    """Sube un archivo en una sola peticion (recomendado solo para tamano pequeno)."""
    if course_id is not None:
        await _ensure_owned_course(db, current_user.id, course_id)

    original = Path(file.filename or "archivo").name
    extension = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(sorted(settings.allowed_extensions))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extension no permitida. Permitidas: {allowed}",
        )

    document_id = uuid.uuid4()
    folder = "general" if course_id is None else str(course_id)
    rel_dir = os.path.join(str(current_user.id), folder)
    abs_dir = os.path.join(settings.files_dir, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    stored_name = f"{document_id}.{extension}" if extension else str(document_id)
    rel_path = os.path.join(rel_dir, stored_name)
    abs_path = os.path.join(settings.files_dir, rel_path)

    max_bytes = settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        with open(abs_path, "wb") as out:
            while chunk := await file.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"El archivo supera el limite de {settings.max_upload_mb} MB",
                    )
                out.write(chunk)
    except HTTPException:
        _safe_remove(abs_path)
        raise
    except OSError as exc:
        _safe_remove(abs_path)
        logger.error("No se pudo guardar el archivo: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo guardar el archivo",
        ) from exc
    finally:
        await file.close()

    document = Document(
        id=document_id,
        user_id=current_user.id,
        course_id=course_id,
        filename=original,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=size,
        storage_path=rel_path,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    notify(current_user.id, "files", {"action": "created", "id": str(document.id)})
    return document


@router.get("/{document_id}/download")
async def download_file(
    document_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> FileResponse:
    """Descarga un documento propio o compartido en una clase a la que perteneces."""
    document = await _get_readable_document(db, current_user.id, document_id)
    abs_path = os.path.join(settings.files_dir, document.storage_path)
    if not os.path.exists(abs_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe en el almacenamiento",
        )
    return FileResponse(
        abs_path,
        filename=document.filename,
        media_type=document.content_type or "application/octet-stream",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_file(
    document_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Borra un documento: quien lo subio o el propietario de la clase."""
    document = await _get_readable_document(db, current_user.id, document_id)
    if document.user_id != current_user.id:
        is_owner = (
            document.class_id is not None
            and await _is_class_owner(db, current_user.id, document.class_id)
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo quien lo subio o el propietario de la clase pueden borrarlo",
            )

    abs_path = os.path.join(settings.files_dir, document.storage_path)
    owner_id = document.user_id
    class_id = document.class_id
    await db.delete(document)
    await db.commit()
    _safe_remove(abs_path)

    notify(owner_id, "files", {"action": "deleted", "id": str(document_id)})
    if current_user.id != owner_id:
        notify(current_user.id, "files", {"action": "deleted", "id": str(document_id)})
    if class_id is not None:
        await class_service.notify_class(db, class_id, "file", id=str(document_id))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _ensure_owned_course(
    db: DbSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(Course.id).where(Course.id == course_id, Course.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asignatura no encontrada"
        )


async def _ensure_class_member(
    db: DbSession, user_id: uuid.UUID, class_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(ClassMembership.id).where(
            ClassMembership.class_id == class_id,
            ClassMembership.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No eres miembro de esta clase",
        )


async def _is_class_owner(
    db: DbSession, user_id: uuid.UUID, class_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(SharedClass.id).where(
            SharedClass.id == class_id, SharedClass.owner_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_readable_document(
    db: DbSession, user_id: uuid.UUID, document_id: uuid.UUID
) -> Document:
    """Devuelve el documento si es del usuario o si es miembro de su clase."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is not None:
        if document.user_id == user_id:
            return document
        if document.class_id is not None:
            membership = await db.execute(
                select(ClassMembership.id).where(
                    ClassMembership.class_id == document.class_id,
                    ClassMembership.user_id == user_id,
                )
            )
            if membership.scalar_one_or_none() is not None:
                return document
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado"
    )


def _safe_remove(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as exc:  # pragma: no cover - best effort
        logger.warning("No se pudo borrar %s: %s", path, exc)
