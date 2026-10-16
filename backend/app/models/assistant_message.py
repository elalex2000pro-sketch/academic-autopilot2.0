"""Modelo de mensajes del asistente de IA (historial de conversacion)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class AssistantMessage(UUIDPkMixin, TimestampMixin, Base):
    """Un turno de la conversacion con el asistente (role: user|assistant)."""

    __tablename__ = "assistant_messages"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Imagen adjunta al mensaje (fotos enviadas a la IA con vision).
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(20))  # ai | heuristic

    user: Mapped["User"] = relationship(back_populates="assistant_messages")
    document: Mapped["Document | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AssistantMessage {self.role} source={self.source}>"
