"""Esquemas del chat de IA Studio."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageAttachment(BaseModel):
    """Adjunto tal y como se guarda y se muestra en el historial."""

    name: str = Field(..., min_length=1, max_length=200)
    mime_type: str = Field(..., max_length=60)
    # Miniatura en data URL (nunca la imagen completa: pesa demasiado en la BD).
    preview: str | None = Field(default=None, max_length=400_000)
    page: int | None = Field(default=None, ge=1)
    total_pages: int | None = Field(default=None, ge=1)


class ChatAttachment(MessageAttachment):
    """Imagen o página de PDF renderizada que se envía al modelo."""

    data: str = Field(..., min_length=1, max_length=12_000_000)


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    # Imagen adjunta (documento subido antes mediante /files). Opcional.
    document_id: uuid.UUID | None = None
    # Fotos y páginas de PDF renderizadas en el navegador (máximo 6).
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=6)


class PendingAction(BaseModel):
    """Accion destructiva que espera confirmacion del usuario."""

    tool: str
    args: dict = Field(default_factory=dict)


class ConfirmRequest(BaseModel):
    tool: str
    args: dict = Field(default_factory=dict)
    approve: bool


class AssistantMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    source: str | None = None
    document_id: uuid.UUID | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    created_at: datetime


class ChatResponse(BaseModel):
    reply: str
    source: str  # ai | heuristic
    created_at: datetime
    document_id: uuid.UUID | None = None
    pending_action: PendingAction | None = None


class AssistantStatus(BaseModel):
    enabled: bool
    configured: bool
    model: str
    vision_model: str
    tools_enabled: bool
    base_url: str
    provider: str = "local"  # local | gemini
    has_api_key: bool = False


class AiProfileUpdate(BaseModel):
    """Cambio de proveedor de IA desde Ajustes."""

    provider: str = Field(..., pattern="^(local|gemini|openai|claude|openrouter|custom)$")
    # Clave de API del proveedor. Si no se envia, se conserva la guardada.
    api_key: str | None = Field(default=None, max_length=500)
    # Modelo concreto (opcional; vacio = modelo por defecto del proveedor).
    model: str | None = Field(default=None, max_length=120)
    # Endpoint personalizado (solo para "custom"; los presets ya lo definen).
    base_url: str | None = Field(default=None, max_length=300)


class AssistantImportMessage(BaseModel):
    """Mensaje de una conversacion exportada (transportar los chats)."""

    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)
    created_at: datetime | None = None


class AssistantImportRequest(BaseModel):
    messages: list[AssistantImportMessage] = Field(..., min_length=1, max_length=2000)

