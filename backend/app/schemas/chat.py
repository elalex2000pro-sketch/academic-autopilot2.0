"""Esquemas del chat y de los nombres de usuario."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ChatUserRead(BaseModel):
    """Datos publicos minimos de una persona dentro del chat."""

    id: uuid.UUID
    username: str | None = None
    display_name: str
    is_verified: bool = False


class ChatMemberRead(BaseModel):
    user: ChatUserRead
    role: str


class ChatAttachmentRead(BaseModel):
    name: str
    content_type: str
    size_bytes: int


class ChatMessageRead(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_username: str | None = None
    sender_verified: bool = False
    content: str
    attachment: ChatAttachmentRead | None = None
    # Ticks del chat: enviado, entregado o leído.
    status: Literal["sent", "delivered", "read"] = "sent"
    created_at: datetime


class ChatConversationRead(BaseModel):
    id: uuid.UUID
    kind: Literal["direct", "group"] | str
    title: str | None
    members: list[ChatMemberRead]
    last_message: ChatMessageRead | None = None
    unread_count: int = 0
    updated_at: datetime


class ChatConversationCreate(BaseModel):
    kind: Literal["direct", "group"] = "group"
    title: str | None = Field(default=None, max_length=200)
    member_ids: list[uuid.UUID] = Field(default_factory=list)
    # Alternativa a los ids: "@ana", "ana".
    usernames: list[str] = Field(default_factory=list, max_length=50)


class ChatInvite(BaseModel):
    username: str = Field(min_length=1, max_length=80)


class ChatMessageCreate(BaseModel):
    content: str = Field(default="", max_length=4000)


class UsernameUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=24)


class UsernameAvailability(BaseModel):
    username: str
    valid: bool
    available: bool
    reason: str | None = None
