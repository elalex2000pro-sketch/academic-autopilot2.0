"""Modelo de horario: una clase recurrente de la semana."""
from __future__ import annotations

import uuid
from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class TimetableEntry(UUIDPkMixin, TimestampMixin, Base):
    """Clase del horario (ej. 'Analisis' los martes de 10:00 a 12:00, aula B3)."""

    __tablename__ = "timetable_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )

    title: Mapped[str | None] = mapped_column(String(300))
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Lunes .. 6=Domingo
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))

    user: Mapped["User"] = relationship(back_populates="timetable_entries")
    course: Mapped["Course | None"] = relationship(back_populates="timetable_entries")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TimetableEntry dow={self.day_of_week} {self.start_time}-{self.end_time}>"
