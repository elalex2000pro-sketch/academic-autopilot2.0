"""Chat: conversaciones privadas y grupales, adjuntos y avisos en tiempo real."""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.core.text import normalize_filename
from app.models.chat import ChatConversation, ChatMember, ChatMessage
from app.models.user import User
from app.schemas.chat import (
    ChatAttachmentRead,
    ChatConversationCreate,
    ChatConversationRead,
    ChatInvite,
    ChatMemberRead,
    ChatMessageRead,
    ChatUserRead,
)
from app.services.realtime import manager, notify

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)

MAX_ATTACHMENT_MB = 25
_ALLOWED_ATTACHMENTS = {
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "txt",
    "md",
    "csv",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
}


# --------------------------------------------------------------------- utils


def _display_name(user: User) -> str:
    return (user.full_name or "").strip() or (user.username or user.email.split("@")[0])


def _user_read(user: User) -> ChatUserRead:
    return ChatUserRead(
        id=user.id,
        username=user.username,
        display_name=_display_name(user),
        is_verified=bool(user.is_verified),
        online=manager.is_online(user.id),
        last_seen_at=user.last_seen_at,
    )


def _attachment_read(message: ChatMessage) -> ChatAttachmentRead | None:
    if not message.attachment_path or not message.attachment_name:
        return None
    return ChatAttachmentRead(
        name=message.attachment_name,
        content_type=message.attachment_type or "application/octet-stream",
        size_bytes=message.attachment_size or 0,
    )


def _message_read(message: ChatMessage, sender: User) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=_display_name(sender),
        sender_username=sender.username,
        sender_verified=bool(sender.is_verified),
        content=message.content,
        attachment=_attachment_read(message),
        status=(message.status if message.status in ("sent", "delivered", "read") else "sent"),
        created_at=message.created_at,
    )


def _at_or_after(watermark: datetime | None, created: datetime) -> bool:
    if watermark is None:
        return False
    # SQLite test snapshots use naive UTC; PostgreSQL returns aware values.
    watermark = watermark.replace(tzinfo=UTC) if watermark.tzinfo is None else watermark
    created = created.replace(tzinfo=UTC) if created.tzinfo is None else created
    return watermark >= created


async def _advance_status(
    db: DbSession,
    conversation_id: uuid.UUID,
    reader_id: uuid.UUID,
    new_status: str,
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Sube el estado de los mensajes ajenos. Nunca retrocede un tick."""
    allowed = ("sent",) if new_status == "delivered" else ("sent", "delivered")
    messages = list(
        (
            await db.execute(
                select(ChatMessage).where(
                    ChatMessage.conversation_id == conversation_id,
                    ChatMessage.sender_id != reader_id,
                    ChatMessage.status.in_(allowed),
                )
            )
        ).scalars()
    )
    by_sender: dict[uuid.UUID, list[uuid.UUID]] = {}
    members = list(
        (
            await db.execute(
                select(ChatMember).where(ChatMember.conversation_id == conversation_id)
            )
        ).scalars()
    )
    for message in messages:
        recipients = [member for member in members if member.user_id != message.sender_id]
        if not recipients or not all(
            _at_or_after(
                member.last_read_at if new_status == "read" else member.last_delivered_at,
                message.created_at,
            )
            for member in recipients
        ):
            continue
        message.status = new_status
        by_sender.setdefault(message.sender_id, []).append(message.id)
    return by_sender


def _notify_status(
    conversation_id: uuid.UUID,
    new_status: str,
    by_sender: dict[uuid.UUID, list[uuid.UUID]],
) -> None:
    """Avisa a cada emisor de los mensajes que acaban de cambiar de estado."""
    for sender_id, message_ids in by_sender.items():
        notify(
            sender_id,
            "chat",
            {
                "conversation_id": str(conversation_id),
                "action": "status",
                "status": new_status,
                "message_ids": [str(message_id) for message_id in message_ids],
            },
        )


async def _require_member(
    db: DbSession, conversation_id: uuid.UUID, user_id: uuid.UUID, *, lock: bool = False
) -> tuple[ChatConversation, ChatMember]:
    statement = select(ChatConversation).where(ChatConversation.id == conversation_id)
    if lock:
        # Serialize receipt transactions before reading recipient watermarks.
        # PostgreSQL READ COMMITTED then sees the previous acknowledgment.
        statement = statement.with_for_update()
    conversation = (await db.execute(statement)).scalar_one_or_none()
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversacion no encontrada"
        )
    member = (
        await db.execute(
            select(ChatMember).where(
                ChatMember.conversation_id == conversation_id,
                ChatMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a esta conversacion",
        )
    return conversation, member


async def _resolve_users(
    db: DbSession,
    member_ids: list[uuid.UUID],
    usernames: list[str],
    exclude_id: uuid.UUID,
) -> list[User]:
    """Acepta ids o @usuarios y devuelve los usuarios encontrados sin duplicados."""
    found: dict[uuid.UUID, User] = {}

    if member_ids:
        rows = await db.execute(select(User).where(User.id.in_(set(member_ids))))
        for user in rows.scalars():
            found[user.id] = user

    cleaned = [name.strip().lstrip("@").lower() for name in usernames if name.strip()]
    if cleaned:
        rows = await db.execute(select(User).where(func.lower(User.username).in_(cleaned)))
        for user in rows.scalars():
            found[user.id] = user

    return [user for user in found.values() if user.id != exclude_id]


async def _conversation_read(
    db: DbSession, conversation: ChatConversation, viewer_id: uuid.UUID
) -> ChatConversationRead:
    members = list(
        (
            await db.execute(
                select(ChatMember).where(ChatMember.conversation_id == conversation.id)
            )
        ).scalars()
    )
    user_ids = {member.user_id for member in members}
    users = {
        user.id: user
        for user in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars()
    }

    last_message = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    my_membership = next((m for m in members if m.user_id == viewer_id), None)
    since = (
        my_membership.last_read_at
        if my_membership and my_membership.last_read_at
        else datetime(1970, 1, 1, tzinfo=UTC)
    )
    unread = (
        await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.conversation_id == conversation.id,
                ChatMessage.sender_id != viewer_id,
                ChatMessage.created_at > since,
            )
        )
    ).scalar_one()

    return ChatConversationRead(
        id=conversation.id,
        kind=conversation.kind,
        title=conversation.title,
        members=[
            ChatMemberRead(
                user=_user_read(users[member.user_id]),
                role=member.role,
            )
            for member in members
            if member.user_id in users
        ],
        last_message=(
            _message_read(last_message, users[last_message.sender_id])
            if last_message and last_message.sender_id in users
            else None
        ),
        unread_count=int(unread or 0),
        updated_at=conversation.updated_at,
    )


async def _restore_direct_members(
    db: DbSession, conversation_id: uuid.UUID, user_ids: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Reopen an existing pair if a participant left using an older app version."""
    for user_id in user_ids:
        found = (
            await db.execute(
                select(ChatMember.id).where(
                    ChatMember.conversation_id == conversation_id, ChatMember.user_id == user_id
                )
            )
        ).first()
        if found is None:
            try:
                async with db.begin_nested():
                    db.add(
                        ChatMember(conversation_id=conversation_id, user_id=user_id, role="member")
                    )
                    await db.flush()
            except IntegrityError:
                pass  # Another request restored exactly the same membership.
    await db.commit()


# ------------------------------------------------------------------ personas


@router.get("/users", response_model=list[ChatUserRead])
async def search_users(
    current_user: CurrentUser,
    db: DbSession,
    q: str = Query("", max_length=80),
) -> list[ChatUserRead]:
    """Busca identificadores publicos; los correos privados no son contactos."""
    term = q.strip().lstrip("@").lower()
    if not term or not all(char.isascii() and (char.isalnum() or char == "_") for char in term):
        return []
    stmt = select(User).where(User.id != current_user.id)
    stmt = stmt.where(func.lower(User.username).startswith(term, autoescape=True))
    stmt = stmt.order_by(User.username.asc().nullslast(), User.full_name.asc().nullslast()).limit(
        10
    )
    rows = await db.execute(stmt)
    return [_user_read(user) for user in rows.scalars()]


# ------------------------------------------------------------ conversaciones


@router.get("/conversations", response_model=list[ChatConversationRead])
async def list_conversations(
    current_user: CurrentUser, db: DbSession
) -> list[ChatConversationRead]:
    """Conversaciones del usuario, la mas reciente primero."""
    rows = await db.execute(
        select(ChatConversation)
        .join(ChatMember, ChatMember.conversation_id == ChatConversation.id)
        .where(ChatMember.user_id == current_user.id)
        .order_by(ChatConversation.updated_at.desc())
        .limit(100)
    )
    conversations = list(rows.scalars().unique())
    return [
        await _conversation_read(db, conversation, current_user.id)
        for conversation in conversations
    ]


@router.post(
    "/conversations",
    response_model=ChatConversationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: ChatConversationCreate, current_user: CurrentUser, db: DbSession
) -> ChatConversationRead:
    """Crea un chat privado (reutiliza el existente) o un grupo con invitados."""
    invited = await _resolve_users(db, payload.member_ids, payload.usernames, current_user.id)

    if payload.kind == "direct":
        if len(invited) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un chat privado es entre dos personas",
            )
        other = invited[0]
        direct_key = ":".join(sorted([str(current_user.id), str(other.id)]))
        existing = (
            await db.execute(
                select(ChatConversation).where(ChatConversation.direct_key == direct_key)
            )
        ).scalar_one_or_none()
        if existing is not None:
            await _restore_direct_members(db, existing.id, (current_user.id, other.id))
            return await _conversation_read(db, existing, current_user.id)
        conversation = ChatConversation(
            kind="direct", title=None, owner_id=None, direct_key=direct_key
        )
    else:
        title = (payload.title or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El grupo necesita un nombre",
            )
        if not invited:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invita al menos a una persona",
            )
        conversation = ChatConversation(kind="group", title=title[:200], owner_id=current_user.id)

    db.add(conversation)
    viewer_id = current_user.id
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        if payload.kind == "direct":
            existing = (
                await db.execute(
                    select(ChatConversation).where(ChatConversation.direct_key == direct_key)
                )
            ).scalar_one_or_none()
            if existing is not None:
                return await _conversation_read(db, existing, viewer_id)
        raise
    db.add(
        ChatMember(
            conversation_id=conversation.id,
            user_id=current_user.id,
            role="owner" if conversation.kind == "group" else "member",
            last_read_at=datetime.now(tz=UTC),
        )
    )
    for user in invited:
        db.add(ChatMember(conversation_id=conversation.id, user_id=user.id, role="member"))
    await db.commit()
    await db.refresh(conversation)

    for user in [current_user, *invited]:
        notify(
            user.id,
            "chat",
            {"conversation_id": str(conversation.id), "action": "created"},
        )
    logger.info("Chat creado: %s (%s)", conversation.id, conversation.kind)
    return await _conversation_read(db, conversation, current_user.id)


@router.post(
    "/conversations/{conversation_id}/members",
    response_model=ChatConversationRead,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    conversation_id: uuid.UUID,
    payload: ChatInvite,
    current_user: CurrentUser,
    db: DbSession,
) -> ChatConversationRead:
    """Invita a una persona por @usuario (solo grupos y solo el propietario)."""
    conversation, membership = await _require_member(db, conversation_id, current_user.id)
    if conversation.kind != "group":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los chats privados no admiten invitados",
        )
    if membership.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario puede invitar",
        )
    invited = await _resolve_users(db, [], [payload.username], current_user.id)
    if not invited:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe ese @usuario",
        )
    new_member = invited[0]
    already = (
        await db.execute(
            select(ChatMember).where(
                ChatMember.conversation_id == conversation.id,
                ChatMember.user_id == new_member.id,
            )
        )
    ).scalar_one_or_none()
    if already is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esa persona ya esta en el grupo",
        )
    db.add(ChatMember(conversation_id=conversation.id, user_id=new_member.id, role="member"))
    await db.commit()
    notify(
        new_member.id,
        "chat",
        {"conversation_id": str(conversation.id), "action": "created"},
    )
    for member in (
        await db.execute(
            select(ChatMember.user_id).where(ChatMember.conversation_id == conversation.id)
        )
    ).scalars():
        notify(
            member,
            "chat",
            {"conversation_id": str(conversation.id), "action": "members"},
        )
    return await _conversation_read(db, conversation, current_user.id)


@router.delete(
    "/conversations/{conversation_id}/members/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def leave_conversation(conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    """Sale de la conversacion. Si queda vacia, se elimina con sus mensajes."""
    conversation, membership = await _require_member(db, conversation_id, current_user.id)
    if conversation.kind == "direct":
        raise HTTPException(
            status_code=400, detail="Los chats privados conservan sus dos participantes"
        )
    await db.delete(membership)
    await db.flush()
    remaining = (
        await db.execute(
            select(func.count(ChatMember.id)).where(ChatMember.conversation_id == conversation.id)
        )
    ).scalar_one()
    if int(remaining) == 0:
        await db.delete(conversation)
    await db.commit()


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    through: Annotated[uuid.UUID | None, Query()] = None,
):
    """Marca la conversacion como leida y avisa al emisor con el doble tick azul."""
    _, membership = await _require_member(db, conversation_id, current_user.id, lock=True)
    cutoff = datetime.now(tz=UTC)
    if through is not None:
        cutoff = (
            await db.execute(
                select(ChatMessage.created_at).where(
                    ChatMessage.id == through, ChatMessage.conversation_id == conversation_id
                )
            )
        ).scalar_one_or_none()
        if cutoff is None:
            raise HTTPException(status_code=404, detail="Mensaje de referencia no encontrado")
    if not _at_or_after(membership.last_read_at, cutoff):
        membership.last_read_at = cutoff
    if not _at_or_after(membership.last_delivered_at, cutoff):
        membership.last_delivered_at = cutoff
    await db.flush()
    delivered = await _advance_status(db, conversation_id, current_user.id, "delivered")
    changed = await _advance_status(db, conversation_id, current_user.id, "read")
    await db.commit()
    _notify_status(conversation_id, "delivered", delivered)
    _notify_status(conversation_id, "read", changed)


@router.post(
    "/conversations/{conversation_id}/delivered",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def mark_delivered(conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    """Confirma que el mensaje llego al dispositivo del destinatario."""
    _, membership = await _require_member(db, conversation_id, current_user.id, lock=True)
    membership.last_delivered_at = datetime.now(tz=UTC)
    await db.flush()
    changed = await _advance_status(db, conversation_id, current_user.id, "delivered")
    await db.commit()
    _notify_status(conversation_id, "delivered", changed)


@router.post("/delivered", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_delivered(current_user: CurrentUser, db: DbSession):
    """Acknowledge receipt on connection/reconnection, even outside the chat view."""
    conversation_ids = list(
        (
            await db.execute(
                select(ChatMember.conversation_id)
                .where(ChatMember.user_id == current_user.id)
                .order_by(ChatMember.conversation_id)
            )
        ).scalars()
    )
    updates = []
    # Stable ordering prevents deadlocks when two reconnects share many chats.
    for conversation_id in conversation_ids:
        _, membership = await _require_member(db, conversation_id, current_user.id, lock=True)
        membership.last_delivered_at = datetime.now(tz=UTC)
        await db.flush()
        updates.append(
            (
                conversation_id,
                await _advance_status(db, conversation_id, current_user.id, "delivered"),
            )
        )
    await db.commit()
    for conversation_id, changed in updates:
        _notify_status(conversation_id, "delivered", changed)


@router.get("/conversations/{conversation_id}/presence", response_model=list[ChatUserRead])
async def conversation_presence(
    conversation_id: uuid.UUID, current_user: CurrentUser, db: DbSession
):
    await _require_member(db, conversation_id, current_user.id)
    rows = await db.execute(
        select(User)
        .join(ChatMember, ChatMember.user_id == User.id)
        .where(ChatMember.conversation_id == conversation_id, User.id != current_user.id)
    )
    return [_user_read(user) for user in rows.scalars()]


# ------------------------------------------------------------------ mensajes


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[ChatMessageRead],
)
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    before: Annotated[datetime | None, Query()] = None,
) -> list[ChatMessageRead]:
    """Ultimos mensajes en orden cronologico; `before` carga los anteriores."""
    await _require_member(db, conversation_id, current_user.id)

    stmt = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
    if before is not None:
        stmt = stmt.where(ChatMessage.created_at < before)
    stmt = stmt.order_by(ChatMessage.created_at.desc()).limit(limit)
    messages = list((await db.execute(stmt)).scalars())
    messages.reverse()
    if not messages:
        return []

    senders = {
        user.id: user
        for user in (
            await db.execute(select(User).where(User.id.in_({m.sender_id for m in messages})))
        ).scalars()
    }
    return [
        _message_read(message, senders[message.sender_id])
        for message in messages
        if message.sender_id in senders
    ]


def _write_attachment(directory: str, name: str, data: bytes) -> None:
    os.makedirs(directory, exist_ok=True)
    with open(os.path.join(directory, name), "wb") as handle:
        handle.write(data)


async def _save_attachment(conversation_id: uuid.UUID, upload: UploadFile) -> dict[str, object]:
    filename = normalize_filename(upload.filename or "adjunto")
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in _ALLOWED_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de adjunto no permitido",
        )
    data = await upload.read(MAX_ATTACHMENT_MB * 1024 * 1024 + 1)
    if len(data) > MAX_ATTACHMENT_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El adjunto supera {MAX_ATTACHMENT_MB} MB",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El adjunto esta vacio")

    relative_dir = os.path.join("chat", str(conversation_id))
    absolute_dir = os.path.join(settings.files_dir, relative_dir)
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    await asyncio.to_thread(_write_attachment, absolute_dir, stored_name, data)

    return {
        "attachment_name": filename[:300],
        "attachment_type": {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "webp": "image/webp",
            "pdf": "application/pdf",
        }.get(extension, "application/octet-stream"),
        "attachment_size": len(data),
        "attachment_path": os.path.join(relative_dir, stored_name),
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatMessageRead,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    content: str = Form(""),
    file: Annotated[UploadFile | None, File()] = None,
) -> ChatMessageRead:
    """Envia texto y/o un adjunto y avisa a todos los miembros por WebSocket."""
    conversation, _ = await _require_member(db, conversation_id, current_user.id)

    text = (content or "").strip()
    if len(text) > 4000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El mensaje es demasiado largo",
        )
    if not text and file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escribe un mensaje o adjunta un archivo",
        )

    attachment = await _save_attachment(conversation.id, file) if file else {}

    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=text,
        created_at=datetime.now(tz=UTC),
        **attachment,
    )
    conversation.updated_at = datetime.now(tz=UTC)
    db.add(message)
    await db.commit()
    await db.refresh(message)

    read = _message_read(message, current_user)
    for user_id in (
        await db.execute(
            select(ChatMember.user_id).where(ChatMember.conversation_id == conversation.id)
        )
    ).scalars():
        notify(
            user_id,
            "chat",
            {
                "conversation_id": str(conversation.id),
                # Metadatos para que el aviso nativo titula bien un grupo.
                "conversation_kind": conversation.kind,
                "conversation_title": conversation.title,
                "action": "message",
                "message_id": str(message.id),
                "message": read.model_dump(mode="json"),
            },
        )

    return read


@router.get("/messages/{message_id}/attachment")
async def download_attachment(
    message_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> FileResponse:
    """Descarga el adjunto de un mensaje (solo miembros de la conversacion)."""
    message = (
        await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    ).scalar_one_or_none()
    if message is None or not message.attachment_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adjunto no encontrado")
    await _require_member(db, message.conversation_id, current_user.id)

    absolute_path = os.path.join(settings.files_dir, message.attachment_path)
    if not os.path.exists(absolute_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo ya no esta en el servidor",
        )
    return FileResponse(
        absolute_path,
        media_type=message.attachment_type or "application/octet-stream",
        filename=message.attachment_name or "adjunto",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"adjunto\"; "
                f"filename*=UTF-8''{quote(message.attachment_name or 'adjunto')}"
            )
        },
    )
