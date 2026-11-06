"""Modelos del chat: conversaciones privadas y grupales, miembros y mensajes."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.user import User


class ChatConversation(UUIDPkMixin, TimestampMixin, Base):
    """Una conversacion: privada entre dos personas o grupo con titulo."""

    __tablename__ = "chat_conversations"

    # "direct" (dos personas) o "group" (varias, con titulo).
    kind: Mapped[str] = mapped_column(String(12), default="group", nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    # Clave de la pareja en un chat privado: "uuidA:uuidB" ordenados. El indice
    # unico garantiza que solo exista una conversacion por pareja.
    direct_key: Mapped[str | None] = mapped_column(String(80), unique=True)

    members: Mapped[list["ChatMember"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ChatConversation {self.kind} {self.title!r}>"


class ChatMember(UUIDPkMixin, TimestampMixin, Base):
    """Pertenencia de un usuario a una conversacion, con su ultimo leido."""

    __tablename__ = "chat_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_chat_member"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # "owner" (quien creo el grupo) o "member".
    role: Mapped[str] = mapped_column(String(16), default="member", nullable=False)
    # Se actualiza al abrir la conversacion; sirve para contar no leidos.
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversation: Mapped["ChatConversation"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ChatMember conv={self.conversation_id} user={self.user_id}>"


class ChatMessage(UUIDPkMixin, TimestampMixin, Base):
    """Mensaje de texto con adjunto opcional (PDF, imagen, documento...)."""

    __tablename__ = "chat_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Adjunto: se guarda en disco y aqui solo quedan los metadatos.
    attachment_name: Mapped[str | None] = mapped_column(String(300))
    attachment_type: Mapped[str | None] = mapped_column(String(120))
    attachment_size: Mapped[int | None] = mapped_column(Integer)
    attachment_path: Mapped[str | None] = mapped_column(String(500))

    conversation: Mapped["ChatConversation"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ChatMessage conv={self.conversation_id} sender={self.sender_id}>"
