"""Esquemas del asistente de IA."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    # Imagen adjunta (documento subido antes mediante /files). Opcional.
    document_id: uuid.UUID | None = None


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

    provider: str = Field(..., pattern="^(local|gemini)$")
    # Clave de API de Gemini. Si no se envia, se conserva la guardada.
    api_key: str | None = Field(default=None, max_length=500)

