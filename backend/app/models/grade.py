"""Modelo de calificacion (nota) de una asignatura."""
from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Grade(UUIDPkMixin, TimestampMixin, Base):
    """Nota de una evaluacion (examen, practica, trabajo...)."""

    __tablename__ = "grades"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    weight: Mapped[float | None] = mapped_column(Float)
    graded_at: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="grades")
    course: Mapped["Course | None"] = relationship(back_populates="grades")

    @property
    def percentage(self) -> float | None:
        if self.score is None or not self.max_score:
            return None
        return round((self.score / self.max_score) * 100, 2)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Grade {self.title!r} {self.score}/{self.max_score}>"
