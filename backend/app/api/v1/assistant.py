"""Endpoints del asistente de IA (chat de organizacion del estudio).

El asistente puede ademas OPERAR la app mediante herramientas (crear/editar
elementos). Las operaciones destructivas se devuelven como accion pendiente y
solo se ejecutan cuando el usuario confirma (endpoint /confirm).
"""
from __future__ import annotations

import base64
import os
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, select

from app.api.deps import CurrentUser, DbSession
from app.core import crypto
from app.core.config import settings
from app.core.logging import get_logger
from app.models.assistant_message import AssistantMessage
from app.models.document import Document
from app.schemas.assistant import (
    AiProfileUpdate,
    AssistantMessageRead,
    AssistantStatus,
    ChatRequest,
    ChatResponse,
    ConfirmRequest,
    PendingAction,
)
from app.services import ai_service, ai_tools
from app.services.realtime import notify

logger = get_logger(__name__)

router = APIRouter(prefix="/assistant", tags=["assistant"])

_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"}


@router.get("/status", response_model=AssistantStatus)
async def assistant_status(current_user: CurrentUser) -> AssistantStatus:
    profile = ai_service.resolve_profile(current_user)
    return AssistantStatus(
        enabled=settings.ai_enabled,
        configured=profile.configured,
        model=profile.model,
        vision_model=profile.vision_model,
        tools_enabled=profile.tools_enabled,
        base_url=profile.base_url,
        provider=profile.provider,
        has_api_key=bool(profile.api_key),
    )


@router.get("/profile", response_model=AssistantStatus)
async def get_profile(current_user: CurrentUser) -> AssistantStatus:
    """Devuelve el proveedor de IA activo del usuario."""
    return await assistant_status(current_user)


@router.put("/profile", response_model=AssistantStatus)
async def update_profile(
    payload: AiProfileUpdate, current_user: CurrentUser, db: DbSession
) -> AssistantStatus:
    """Cambia el proveedor de IA (Local Ollama / Gemini) y guarda la clave si llega."""
    current_user.ai_provider = payload.provider
    if payload.api_key is not None:
        # Cadena vacia = borrar la clave guardada.
        current_user.ai_api_key_encrypted = crypto.encrypt(payload.api_key.strip()) or None
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    logger.info("Proveedor de IA de %s cambiado a %s", current_user.email, payload.provider)
    return await assistant_status(current_user)


@router.get("/messages", response_model=list[AssistantMessageRead])
async def list_messages(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
) -> list[AssistantMessage]:
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.user_id == current_user.id)
        .order_by(AssistantMessage.created_at.desc())
        .limit(limit)
    )
    return list(reversed(list(result.scalars().all())))


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest, current_user: CurrentUser, db: DbSession
) -> ChatResponse:
    if not payload.message.strip() and payload.document_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escribe un mensaje o adjunta una imagen",
        )

    image_data_url: str | None = None
    if payload.document_id is not None:
        image_data_url = await _image_data_url(db, current_user.id, payload.document_id)

    # Historial reciente (orden cronologico) para dar contexto al modelo.
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.user_id == current_user.id)
        .order_by(AssistantMessage.created_at.desc())
        .limit(settings.ai_history_limit)
    )
    recent = list(reversed(list(result.scalars().all())))
    history = [
        {"role": m.role, "content": m.content}
        for m in recent
        if m.role in ("user", "assistant")
    ]

    user_message = AssistantMessage(
        user_id=current_user.id,
        role="user",
        content=payload.message.strip() or "(imagen adjunta)",
        document_id=payload.document_id,
    )
    db.add(user_message)
    await db.commit()

    result_ai = await ai_service.generate_reply(
        db, current_user, payload.message, history, image_data_url=image_data_url
    )

    assistant_message = AssistantMessage(
        user_id=current_user.id, role="assistant", content=result_ai.reply, source=result_ai.source
    )
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)

    notify(current_user.id, "assistant", {"action": "message", "id": str(assistant_message.id)})
    for event in set(result_ai.events):
        notify(current_user.id, event, {"action": "changed", "by": "ai"})

    pending = (
        PendingAction(**result_ai.pending_action) if result_ai.pending_action else None
    )
    return ChatResponse(
        reply=result_ai.reply,
        source=result_ai.source,
        created_at=assistant_message.created_at,
        document_id=payload.document_id,
        pending_action=pending,
    )


@router.post("/confirm", response_model=ChatResponse)
async def confirm_action(
    payload: ConfirmRequest, current_user: CurrentUser, db: DbSession
) -> ChatResponse:
    if payload.tool not in ai_tools.DESTRUCTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta accion no requiere confirmacion",
        )

    if not payload.approve:
        reply = "De acuerdo, no he realizado ningun cambio."
        return await _store_assistant(db, current_user, reply, [])

    result, events = await ai_tools.execute_tool(db, current_user, payload.tool, payload.args)
    if result.get("ok"):
        reply = f"Listo. He eliminado: {result.get('deleted', 'el elemento')}."
    else:
        reply = f"No he podido completarlo: {result.get('error', 'error desconocido')}."
    return await _store_assistant(db, current_user, reply, events)


async def _store_assistant(
    db: DbSession, current_user: CurrentUser, reply: str, events: list[str]
) -> ChatResponse:
    message = AssistantMessage(
        user_id=current_user.id, role="assistant", content=reply, source="ai"
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    notify(current_user.id, "assistant", {"action": "message", "id": str(message.id)})
    for event in set(events):
        notify(current_user.id, event, {"action": "changed", "by": "ai"})
    return ChatResponse(reply=reply, source="ai", created_at=message.created_at)


@router.delete("/messages", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def clear_messages(current_user: CurrentUser, db: DbSession) -> None:
    await db.execute(delete(AssistantMessage).where(AssistantMessage.user_id == current_user.id))
    await db.commit()
    notify(current_user.id, "assistant", {"action": "cleared"})


async def _image_data_url(
    db: DbSession, user_id: uuid.UUID, document_id: uuid.UUID
) -> str:
    """Carga un documento de imagen y lo devuelve como data URL base64."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")

    content_type = (document.content_type or "").lower()
    if content_type not in _IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo adjunto no es una imagen compatible",
        )
    if document.size_bytes > settings.ai_max_image_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen supera el limite de {settings.ai_max_image_mb} MB",
        )

    abs_path = os.path.join(settings.files_dir, document.storage_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La imagen no existe")

    try:
        with open(abs_path, "rb") as handle:
            encoded = base64.b64encode(handle.read()).decode("ascii")
    except OSError as exc:  # pragma: no cover - best effort
        logger.error("No se pudo leer la imagen: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo leer la imagen"
        ) from exc

    return f"data:{content_type};base64,{encoded}"
