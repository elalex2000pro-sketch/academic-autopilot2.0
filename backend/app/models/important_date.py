"""Fechas importantes del calendario (no son entregas ni exámenes)."""
from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
import uuid

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ImportantDate(UUIDPkMixin, TimestampMixin, Base):
    """Un día señalado por el estudiante (trámite, defensa, aviso...)."""

    __tablename__ = "important_dates"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ImportantDate {self.title!r} {self.date}>"
