"""Modelo de salidas de IA (resumenes e infografias generados)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.user import User


class AiOutput(UUIDPkMixin, TimestampMixin, Base):
    """Resultado del IA Studio: un resumen o infografia (y el PDF generado)."""

    __tablename__ = "ai_outputs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), index=True
    )
    output_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), index=True
    )

    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # summary | infographic
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str | None] = mapped_column(String(20))  # ai | heuristic

    user: Mapped[User] = relationship(back_populates="ai_outputs")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AiOutput {self.kind} {self.title!r}>"
