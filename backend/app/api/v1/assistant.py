"""Endpoints del chat de IA Studio (tutor y organizacion del estudio).

El asistente puede ademas OPERAR la app mediante herramientas (crear/editar
elementos). Las operaciones destructivas se devuelven como accion pendiente y
solo se ejecutan cuando el usuario confirma (endpoint /confirm).
"""
from __future__ import annotations

import base64
import os
import uuid
from datetime import timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, select
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentUser, DbSession
from app.core import crypto
from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.assistant_message import AssistantMessage
from app.models.document import Document
from app.schemas.assistant import (
    AiProfileUpdate,
    AssistantImportRequest,
    AssistantMessageRead,
    AssistantStatus,
    ChatRequest,
    ChatResponse,
    ConfirmRequest,
    PendingAction,
)
from app.services import ai_service, ai_studio_service, ai_tools
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
    """Cambia el proveedor de IA (Local, Gemini, ChatGPT, Claude...) y su clave."""
    current_user.ai_provider = payload.provider
    if payload.api_key is not None:
        # Cadena vacia = borrar la clave guardada.
        current_user.ai_api_key_encrypted = crypto.encrypt(payload.api_key.strip()) or None
    if payload.model is not None:
        # Cadena vacia = volver al modelo por defecto del proveedor.
        current_user.ai_model = payload.model.strip() or None
    if payload.base_url is not None:
        current_user.ai_base_url = payload.base_url.strip().rstrip("/") or None
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
            detail="Escribe un mensaje o adjunta un documento",
        )

    image_data_url: str | None = None
    document_text: str | None = None
    document_name: str | None = None
    if payload.document_id is not None:
        image_data_url, document_text, document_name = await _load_attachment(
            db, current_user.id, payload.document_id
        )

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
        content=payload.message.strip() or "(documento adjunto)",
        document_id=payload.document_id,
    )
    db.add(user_message)
    await db.commit()

    try:
        result_ai = await ai_service.generate_reply(
            db,
            current_user,
            payload.message,
            history,
            image_data_url=image_data_url,
            document_text=document_text,
            document_name=document_name,
        )
    except Exception as exc:  # noqa: BLE001 - el usuario siempre debe recibir respuesta
        logger.error("Fallo inesperado del asistente: %s", exc)
        result_ai = ai_service.AiResult(
            reply=(
                "Lo siento, ha ocurrido un error interno al procesar tu mensaje. "
                "Vuelve a intentarlo en unos segundos."
            ),
            source="error",
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


@router.get("/messages/export", response_model=list[AssistantMessageRead])
async def export_messages(current_user: CurrentUser, db: DbSession) -> list[AssistantMessage]:
    """Exporta TODA la conversacion (para transportarla a otro dispositivo)."""
    result = await db.execute(
        select(AssistantMessage)
        .where(AssistantMessage.user_id == current_user.id)
        .order_by(AssistantMessage.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("/messages/import")
async def import_messages(
    payload: AssistantImportRequest, current_user: CurrentUser, db: DbSession
) -> dict[str, int]:
    """Importa una conversacion exportada (se fusiona con la actual)."""
    base_time = utcnow()
    for index, item in enumerate(payload.messages):
        created = item.created_at
        if created is not None and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        message = AssistantMessage(
            user_id=current_user.id,
            role=item.role,
            content=item.content.strip(),
            source="imported",
        )
        # Sin fecha en el archivo: se conserva el orden original de los mensajes.
        message.created_at = created or base_time + timedelta(milliseconds=index)
        db.add(message)
    await db.commit()
    notify(current_user.id, "assistant", {"action": "imported", "count": len(payload.messages)})
    logger.info("Importados %d mensajes para %s", len(payload.messages), current_user.email)
    return {"imported": len(payload.messages)}


async def _load_attachment(
    db: DbSession, user_id: uuid.UUID, document_id: uuid.UUID
) -> tuple[str | None, str | None, str]:
    """Prepara un archivo adjunto para el chat.

    Devuelve (imagen como data URL, texto extraido, nombre). Las imagenes usan el
    modelo de vision; los apuntes y examenes en PDF/Word/Excel/texto se extraen y
    se inyectan en el prompt para poder responder preguntas sobre ellos.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    content_type = (document.content_type or "").lower()
    if content_type in _IMAGE_TYPES:
        return _image_data_url(document), None, document.filename

    try:
        text = await run_in_threadpool(ai_studio_service.extract_text, document)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El documento no contiene texto que se pueda analizar.",
        )
    return None, text, document.filename


def _image_data_url(document: Document) -> str:
    """Carga un documento de imagen y lo devuelve como data URL base64."""
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

    return f"data:{document.content_type.lower()};base64,{encoded}"
