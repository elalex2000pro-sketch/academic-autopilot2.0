"""Biblioteca privada, importación idempotente y guardado con revisión optimista."""
import uuid
import json
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from app.api.deps import CurrentUser, DbSession
from app.models.office import OfficeDocument, OfficeDocumentVersion

router = APIRouter(prefix="/office/documents", tags=["office"])
MAX_BYTES = 5 * 1024 * 1024

class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["document", "sheet"] = "document"
    content: str = ""
    schema_version: Literal[1] = 1
    settings: dict = Field(default_factory=dict)
    folder: str | None = Field(default=None, max_length=100)

class Create(Payload):
    import_key: str | None = Field(default=None, max_length=100)

class Save(Payload):
    revision: int = Field(ge=1)
    checkpoint: bool = False

class Revision(BaseModel):
    revision: int = Field(ge=1)

FIELDS = ("title", "kind", "content", "schema_version", "settings", "folder")
def snapshot(doc):
    return {key: getattr(doc, key) for key in FIELDS}

def output(doc):
    return dict(snapshot(doc), id=str(doc.id), revision=doc.revision, created_at=doc.created_at, updated_at=doc.updated_at)

def validate_size(data):
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_BYTES:
        raise HTTPException(413, "El documento supera el límite de 5 MB")

async def owned(db, user, ident, lock=False):
    stmt = select(OfficeDocument).where(OfficeDocument.id == ident, OfficeDocument.user_id == user.id)
    doc = await db.scalar(stmt.with_for_update() if lock else stmt)
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    return doc

async def checkpoint(db, doc):
    exists = await db.scalar(select(OfficeDocumentVersion.id).where(OfficeDocumentVersion.document_id == doc.id, OfficeDocumentVersion.revision == doc.revision))
    if not exists:
        db.add(OfficeDocumentVersion(document_id=doc.id, revision=doc.revision, snapshot=snapshot(doc)))
        await db.flush()

@router.get("")
async def listing(db: DbSession, user: CurrentUser, q: str = "", order: Literal["updated", "created", "title"] = "updated"):
    stmt = select(OfficeDocument).where(OfficeDocument.user_id == user.id)
    if q:
        stmt = stmt.where(OfficeDocument.title.icontains(q, autoescape=True))
    sort = {"updated": OfficeDocument.updated_at.desc(), "created": OfficeDocument.created_at.desc(), "title": OfficeDocument.title.asc()}[order]
    docs = (await db.scalars(stmt.order_by(sort, OfficeDocument.id))).all()
    return [{k: v for k, v in output(d).items() if k != "content"} for d in docs]

@router.post("", status_code=201)
async def create(body: Create, db: DbSession, user: CurrentUser):
    data = body.model_dump(); validate_size(data)
    if body.import_key:
        existing = await db.scalar(select(OfficeDocument).where(OfficeDocument.user_id == user.id, OfficeDocument.import_key == body.import_key))
        if existing:
            return output(existing)
    doc = OfficeDocument(user_id=user.id, **data)
    db.add(doc)
    try:
        await db.flush(); await checkpoint(db, doc); await db.commit()
    except IntegrityError:
        await db.rollback()
        if not body.import_key:
            raise
        doc = await db.scalar(select(OfficeDocument).where(OfficeDocument.user_id == user.id, OfficeDocument.import_key == body.import_key))
        if not doc:
            raise
    await db.refresh(doc)
    return output(doc)

@router.get("/{ident}")
async def read(ident: uuid.UUID, db: DbSession, user: CurrentUser):
    return output(await owned(db, user, ident))

async def replace(db, user, ident, revision, data, save_checkpoint):
    validate_size(data)
    doc = await owned(db, user, ident, lock=True)
    # Comparación y escritura en una sola sentencia, también entre procesos.
    result = await db.execute(update(OfficeDocument).where(OfficeDocument.id == ident, OfficeDocument.user_id == user.id, OfficeDocument.revision == revision).values(**data, revision=revision+1).execution_options(synchronize_session=False))
    if result.rowcount != 1:
        raise HTTPException(409, "Hay una versión más reciente. Conservamos tu borrador; abre la versión del servidor o guarda una copia.")
    await db.refresh(doc)
    if save_checkpoint:
        await checkpoint(db, doc)
    await db.commit(); await db.refresh(doc)
    return output(doc)

@router.put("/{ident}")
async def save(ident: uuid.UUID, body: Save, db: DbSession, user: CurrentUser):
    return await replace(db, user, ident, body.revision, body.model_dump(exclude={"revision", "checkpoint"}), body.checkpoint)

@router.post("/{ident}/duplicate", status_code=201)
async def duplicate(ident: uuid.UUID, db: DbSession, user: CurrentUser):
    original = await owned(db, user, ident)
    data = snapshot(original); data["title"] = (original.title[:190] + " (copia)")
    return await create(Create(**data), db, user)

@router.delete("/{ident}", status_code=204)
async def remove(ident: uuid.UUID, db: DbSession, user: CurrentUser):
    await owned(db, user, ident)
    await db.execute(delete(OfficeDocumentVersion).where(OfficeDocumentVersion.document_id == ident))
    await db.execute(delete(OfficeDocument).where(OfficeDocument.id == ident, OfficeDocument.user_id == user.id))
    await db.commit()

@router.get("/{ident}/versions")
async def versions(ident: uuid.UUID, db: DbSession, user: CurrentUser):
    await owned(db, user, ident)
    rows = (await db.scalars(select(OfficeDocumentVersion).where(OfficeDocumentVersion.document_id == ident).order_by(OfficeDocumentVersion.revision.desc()))).all()
    return [dict(id=str(v.id), revision=v.revision, created_at=v.created_at, **v.snapshot) for v in rows]

@router.post("/{ident}/checkpoint")
async def save_checkpoint(ident: uuid.UUID, body: Revision, db: DbSession, user: CurrentUser):
    doc = await db.scalar(select(OfficeDocument).where(OfficeDocument.id == ident, OfficeDocument.user_id == user.id).with_for_update())
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    if doc.revision != body.revision:
        raise HTTPException(409, "La versión del documento ha cambiado")
    await checkpoint(db, doc); await db.commit()
    return {"ok": True}

@router.post("/{ident}/versions/{version_id}/restore")
async def restore(ident: uuid.UUID, version_id: uuid.UUID, body: Revision, db: DbSession, user: CurrentUser):
    doc = await owned(db, user, ident, lock=True)
    version = await db.scalar(select(OfficeDocumentVersion).where(OfficeDocumentVersion.document_id == ident, OfficeDocumentVersion.id == version_id))
    if not version:
        raise HTTPException(404, "Versión no encontrada")
    # Conservar también el estado anterior a restaurar, sin sobrescribir historia.
    if doc.revision != body.revision:
        raise HTTPException(409, "La versión del documento ha cambiado")
    await checkpoint(db, doc)
    return await replace(db, user, ident, body.revision, version.snapshot, True)
