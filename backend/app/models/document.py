"""Modelo de documento: archivos subidos por el usuario (por asignatura)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Document(UUIDPkMixin, TimestampMixin, Base):
    """Archivo (PDF, apunte...) guardado en disco y vinculado a una asignatura."""

    __tablename__ = "documents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )

    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)

    user: Mapped["User"] = relationship(back_populates="documents")
    course: Mapped["Course | None"] = relationship(back_populates="documents")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Document {self.filename!r} {self.size_bytes}B>"
