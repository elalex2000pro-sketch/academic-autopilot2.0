"""Clases compartidas: crear o unirse con un codigo permanente, chat,
calendario conjunto y archivos compartidos.

Diseno:
- Cada clase tiene un **codigo permanente** (no caduca) con el que cualquiera
  puede unirse. El propietario puede regenerarlo.
- Los miembros permanecen en la clase; pueden salir voluntariamente (salvo el
  propietario, que debe eliminar la clase).
- El chat y el calendario avisan por WebSocket a todos los miembros
  (evento "classes" con `class_id` en los datos).
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.logging import get_logger
from app.models.shared_class import (
    ClassEvent,
    ClassMembership,
    ClassMessage,
    SharedClass,
)
from app.models.user import User
from app.schemas.classroom import (
    ClassCreate,
    ClassDetail,
    ClassJoin,
    ClassMemberRead,
    ClassRead,
    ClassUpdate,
    EventCreate,
    EventRead,
    EventUpdate,
    MessageCreate,
    MessageRead,
    MessageUpdate,
)
from app.schemas.file import DocumentRead
from app.models.document import Document
from app.services import class_service
from app.services.realtime import notify

logger = get_logger(__name__)

router = APIRouter(prefix="/classes", tags=["classes"])

# Alfabeto sin caracteres confundibles (sin I, L, O, 0, 1).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _generate_unique_code(db: DbSession) -> str:
    for _ in range(10):
        code = "".join(
            secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH)
        )
        exists = await db.execute(
            select(SharedClass.id).where(SharedClass.code == code)
        )
        if exists.scalar_one_or_none() is None:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo generar un codigo unico",
    )


async def _get_class(db: DbSession, class_id: uuid.UUID) -> SharedClass:
    shared_class = await db.get(SharedClass, class_id)
    if shared_class is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada"
        )
    return shared_class


async def _get_membership(
    db: DbSession, class_id: uuid.UUID, user_id: uuid.UUID
) -> ClassMembership | None:
    result = await db.execute(
        select(ClassMembership).where(
            ClassMembership.class_id == class_id,
            ClassMembership.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _require_member(
    db: DbSession, class_id: uuid.UUID, user_id: uuid.UUID
) -> ClassMembership:
    membership = await _get_membership(db, class_id, user_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No eres miembro de esta clase",
        )
    return membership


async def _require_owner(
    db: DbSession, class_id: uuid.UUID, user_id: uuid.UUID
) -> SharedClass:
    shared_class = await _get_class(db, class_id)
    membership = await _require_member(db, class_id, user_id)
    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario de la clase puede hacer esto",
        )
    return shared_class


async def _member_count(db: DbSession, class_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(ClassMembership)
        .where(ClassMembership.class_id == class_id)
    )
    return int(result.scalar_one())


def _to_read(shared_class: SharedClass, role: str, member_count: int) -> ClassRead:
    return ClassRead(
        id=shared_class.id,
        name=shared_class.name,
        description=shared_class.description,
        code=shared_class.code,
        owner_id=shared_class.owner_id,
        created_at=shared_class.created_at,
        member_count=member_count,
        my_role=role,
    )


async def _get_event(
    db: DbSession, class_id: uuid.UUID, event_id: uuid.UUID
) -> ClassEvent:
    result = await db.execute(
        select(ClassEvent).where(
            ClassEvent.id == event_id, ClassEvent.class_id == class_id
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento no encontrado"
        )
    return event


async def _get_message(
    db: DbSession, class_id: uuid.UUID, message_id: uuid.UUID
) -> ClassMessage:
    result = await db.execute(
        select(ClassMessage).where(
            ClassMessage.id == message_id, ClassMessage.class_id == class_id
        )
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado"
        )
    return message


def _event_read(event: ClassEvent, creator_name: str | None) -> EventRead:
    return EventRead(
        id=event.id,
        class_id=event.class_id,
        created_by=event.created_by,
        creator_name=creator_name,
        title=event.title,
        description=event.description,
        location=event.location,
        start_at=event.start_at,
        end_at=event.end_at,
        all_day=event.all_day,
        created_at=event.created_at,
    )


# --------------------------------------------------------------------------- #
# Clases
# --------------------------------------------------------------------------- #
@router.post("", response_model=ClassRead, status_code=status.HTTP_201_CREATED)
async def create_class(
    payload: ClassCreate, current_user: CurrentUser, db: DbSession
) -> ClassRead:
    """Crea una clase compartida y su codigo permanente de union."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de la clase no puede estar vacio",
        )
    shared_class = SharedClass(
        name=name,
        description=(payload.description or "").strip() or None,
        code=await _generate_unique_code(db),
        owner_id=current_user.id,
    )
    db.add(shared_class)
    await db.flush()
    db.add(
        ClassMembership(
            class_id=shared_class.id, user_id=current_user.id, role="owner"
        )
    )
    await db.commit()
    await db.refresh(shared_class)
    logger.info("Clase creada: %s (%s) por %s", shared_class.name, shared_class.code, current_user.email)
    return _to_read(shared_class, "owner", 1)


@router.get("", response_model=list[ClassRead])
async def list_my_classes(current_user: CurrentUser, db: DbSession) -> list[ClassRead]:
    """Lista las clases compartidas a las que pertenece el usuario."""
    rows = await db.execute(
        select(ClassMembership, SharedClass)
        .join(SharedClass, SharedClass.id == ClassMembership.class_id)
        .where(ClassMembership.user_id == current_user.id)
        .order_by(SharedClass.created_at.desc())
    )
    items = rows.all()
    class_ids = [shared_class.id for _, shared_class in items]
    counts: dict[uuid.UUID, int] = {}
    if class_ids:
        count_rows = await db.execute(
            select(ClassMembership.class_id, func.count())
            .where(ClassMembership.class_id.in_(class_ids))
            .group_by(ClassMembership.class_id)
        )
        counts = {cid: int(total) for cid, total in count_rows.all()}
    return [_to_read(sc, m.role, counts.get(sc.id, 0)) for m, sc in items]


@router.post("/join", response_model=ClassRead)
async def join_class(
    payload: ClassJoin, current_user: CurrentUser, db: DbSession
) -> ClassRead:
    """Entra (de forma permanente) en la clase cuyo codigo coincida."""
    code = payload.code.strip().upper()
    result = await db.execute(select(SharedClass).where(SharedClass.code == code))
    shared_class = result.scalar_one_or_none()
    if shared_class is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Codigo de clase no valido",
        )

    membership = await _get_membership(db, shared_class.id, current_user.id)
    if membership is None:
        membership = ClassMembership(
            class_id=shared_class.id, user_id=current_user.id, role="member"
        )
        db.add(membership)
        await db.commit()
        logger.info("%s se unio a la clase %s", current_user.email, shared_class.name)
        await class_service.notify_class(
            db, shared_class.id, "member_joined", user_id=str(current_user.id)
        )
    return _to_read(
        shared_class, membership.role, await _member_count(db, shared_class.id)
    )


@router.get("/{class_id}", response_model=ClassDetail)
async def class_detail(
    class_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ClassDetail:
    """Detalle de la clase con la lista completa de miembros."""
    shared_class = await _get_class(db, class_id)
    membership = await _require_member(db, class_id, current_user.id)

    rows = await db.execute(
        select(ClassMembership, User)
        .join(User, User.id == ClassMembership.user_id)
        .where(ClassMembership.class_id == class_id)
        .order_by(ClassMembership.created_at.asc())
    )
    members = [
        ClassMemberRead(
            user_id=m.user_id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            joined_at=m.created_at,
        )
        for m, u in rows.all()
    ]
    base = _to_read(shared_class, membership.role, len(members))
    return ClassDetail(**base.model_dump(), members=members)


@router.patch("/{class_id}", response_model=ClassRead)
async def update_class(
    class_id: uuid.UUID,
    payload: ClassUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ClassRead:
    """Renombra o cambia la descripcion (solo propietario)."""
    shared_class = await _require_owner(db, class_id, current_user.id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        shared_class.name = data["name"].strip()
    if "description" in data:
        description = (data["description"] or "").strip()
        shared_class.description = description or None
    await db.commit()
    await db.refresh(shared_class)
    await class_service.notify_class(db, class_id, "updated")
    return _to_read(
        shared_class, "owner", await _member_count(db, class_id)
    )


@router.post("/{class_id}/regenerate-code", response_model=ClassRead)
async def regenerate_code(
    class_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ClassRead:
    """Genera un codigo de union nuevo (solo propietario)."""
    shared_class = await _require_owner(db, class_id, current_user.id)
    shared_class.code = await _generate_unique_code(db)
    await db.commit()
    await db.refresh(shared_class)
    await class_service.notify_class(db, class_id, "code")
    return _to_read(
        shared_class, "owner", await _member_count(db, class_id)
    )


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_class(
    class_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Elimina la clase y todo su contenido (solo propietario)."""
    shared_class = await _require_owner(db, class_id, current_user.id)
    member_user_ids = await class_service.member_ids(db, class_id)
    await db.delete(shared_class)
    await db.commit()
    for user_id in member_user_ids:
        notify(user_id, "classes", {"class_id": str(class_id), "action": "deleted"})


@router.post("/{class_id}/leave", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def leave_class(
    class_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    """Sale de la clase (los miembros no propietarios pueden salir)."""
    membership = await _require_member(db, class_id, current_user.id)
    if membership.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El propietario no puede salir; elimina la clase si ya no la quieres",
        )
    await db.delete(membership)
    await db.commit()
    notify(current_user.id, "classes", {"class_id": str(class_id), "action": "left"})
    await class_service.notify_class(
        db, class_id, "member_left", user_id=str(current_user.id)
    )


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #
@router.get("/{class_id}/messages", response_model=list[MessageRead])
async def list_messages(
    class_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(100, ge=1, le=300),
    before: datetime | None = Query(default=None),
) -> list[MessageRead]:
    """Ultimos mensajes del chat (orden cronologico). `before` carga mas antiguos."""
    await _require_member(db, class_id, current_user.id)
    stmt = (
        select(ClassMessage, User.full_name, User.email)
        .join(User, User.id == ClassMessage.user_id)
        .where(ClassMessage.class_id == class_id)
    )
    if before is not None:
        stmt = stmt.where(ClassMessage.created_at < before)
    stmt = stmt.order_by(ClassMessage.created_at.desc()).limit(limit)
    rows = await db.execute(stmt)
    items = list(rows.all())
    items.reverse()
    return [
        MessageRead(
            id=m.id,
            class_id=m.class_id,
            user_id=m.user_id,
            author_name=full_name or email,
            content=m.content,
            kind=m.kind,
            pinned=m.pinned,
            created_at=m.created_at,
        )
        for m, full_name, email in items
    ]


@router.post(
    "/{class_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    class_id: uuid.UUID,
    payload: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageRead:
    """Envia un mensaje al chat (los anuncios son solo del propietario)."""
    membership = await _require_member(db, class_id, current_user.id)
    if payload.kind == "announcement" and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario puede publicar anuncios",
        )
    content = payload.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mensaje no puede estar vacio",
        )
    message = ClassMessage(
        class_id=class_id,
        user_id=current_user.id,
        content=content,
        kind=payload.kind,
        pinned=payload.kind == "announcement",
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    await class_service.notify_class(db, class_id, "message", id=str(message.id))
    return MessageRead(
        id=message.id,
        class_id=message.class_id,
        user_id=message.user_id,
        author_name=current_user.full_name or current_user.email,
        content=message.content,
        kind=message.kind,
        pinned=message.pinned,
        created_at=message.created_at,
    )


@router.patch("/{class_id}/messages/{message_id}", response_model=MessageRead)
async def update_message(
    class_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: MessageUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageRead:
    """Fija o desfija un mensaje (solo propietario)."""
    await _require_owner(db, class_id, current_user.id)
    message = await _get_message(db, class_id, message_id)
    message.pinned = payload.pinned
    await db.commit()
    await db.refresh(message)
    await class_service.notify_class(db, class_id, "message", id=str(message.id))
    author = await db.get(User, message.user_id)
    return MessageRead(
        id=message.id,
        class_id=message.class_id,
        user_id=message.user_id,
        author_name=(author.full_name or author.email) if author else None,
        content=message.content,
        kind=message.kind,
        pinned=message.pinned,
        created_at=message.created_at,
    )


@router.delete(
    "/{class_id}/messages/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_message(
    class_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """Borra un mensaje (su autor o el propietario de la clase)."""
    membership = await _require_member(db, class_id, current_user.id)
    message = await _get_message(db, class_id, message_id)
    if message.user_id != current_user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo su autor o el propietario pueden borrar el mensaje",
        )
    await db.delete(message)
    await db.commit()
    await class_service.notify_class(db, class_id, "message", id=str(message_id))


# --------------------------------------------------------------------------- #
# Calendario conjunto
# --------------------------------------------------------------------------- #
@router.get("/{class_id}/events", response_model=list[EventRead])
async def list_events(
    class_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    since: datetime | None = Query(default=None, alias="from"),
    until: datetime | None = Query(default=None, alias="to"),
) -> list[EventRead]:
    """Eventos del calendario de la clase (filtro opcional por rango)."""
    await _require_member(db, class_id, current_user.id)
    stmt = (
        select(ClassEvent, User.full_name, User.email)
        .join(User, User.id == ClassEvent.created_by)
        .where(ClassEvent.class_id == class_id)
    )
    if since is not None:
        stmt = stmt.where(ClassEvent.start_at >= since)
    if until is not None:
        stmt = stmt.where(ClassEvent.start_at <= until)
    stmt = stmt.order_by(ClassEvent.start_at.asc())
    rows = await db.execute(stmt)
    return [
        _event_read(e, full_name or email) for e, full_name, email in rows.all()
    ]


@router.post(
    "/{class_id}/events",
    response_model=EventRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_event(
    class_id: uuid.UUID,
    payload: EventCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> EventRead:
    """Anade un evento al calendario conjunto (cualquier miembro)."""
    await _require_member(db, class_id, current_user.id)
    if payload.end_at is not None and payload.end_at < payload.start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La hora de fin no puede ser anterior al inicio",
        )
    event = ClassEvent(
        class_id=class_id,
        created_by=current_user.id,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        location=(payload.location or "").strip() or None,
        start_at=payload.start_at,
        end_at=payload.end_at,
        all_day=payload.all_day,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    await class_service.notify_class(db, class_id, "event", id=str(event.id))
    return _event_read(event, current_user.full_name or current_user.email)


@router.patch("/{class_id}/events/{event_id}", response_model=EventRead)
async def update_event(
    class_id: uuid.UUID,
    event_id: uuid.UUID,
    payload: EventUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> EventRead:
    """Edita un evento (su creador o el propietario de la clase)."""
    membership = await _require_member(db, class_id, current_user.id)
    event = await _get_event(db, class_id, event_id)
    if event.created_by != current_user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo su creador o el propietario pueden editar el evento",
        )
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in ("description", "location"):
            text = (value or "").strip() if isinstance(value, str) else value
            setattr(event, field, text or None)
        elif field == "title" and value is not None:
            event.title = value.strip()
        elif value is not None:
            setattr(event, field, value)
    if event.end_at is not None and event.end_at < event.start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La hora de fin no puede ser anterior al inicio",
        )
    await db.commit()
    await db.refresh(event)
    await class_service.notify_class(db, class_id, "event", id=str(event.id))
    creator = await db.get(User, event.created_by)
    return _event_read(event, (creator.full_name or creator.email) if creator else None)


@router.delete(
    "/{class_id}/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def delete_event(
    class_id: uuid.UUID,
    event_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """Elimina un evento (su creador o el propietario de la clase)."""
    membership = await _require_member(db, class_id, current_user.id)
    event = await _get_event(db, class_id, event_id)
    if event.created_by != current_user.id and membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo su creador o el propietario pueden eliminar el evento",
        )
    await db.delete(event)
    await db.commit()
    await class_service.notify_class(db, class_id, "event", id=str(event_id))


# --------------------------------------------------------------------------- #
# Archivos de la clase
# --------------------------------------------------------------------------- #
@router.get("/{class_id}/files", response_model=list[DocumentRead])
async def list_class_files(
    class_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[Document]:
    """Archivos compartidos en la clase (visibles para todos los miembros)."""
    await _require_member(db, class_id, current_user.id)
    result = await db.execute(
        select(Document)
        .where(Document.class_id == class_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())
