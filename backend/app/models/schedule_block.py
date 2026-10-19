"""Plantilla semanal de disponibilidad del usuario."""
from __future__ import annotations

import uuid
from datetime import time
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.user import User


class ScheduleBlock(UUIDPkMixin, TimestampMixin, Base):
    """Franja horaria recurrente (ej. 'Tardes de 16:30 a 20:30')."""

    __tablename__ = "schedule_blocks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Lunes .. 6=Domingo
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    label: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="schedule_blocks")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ScheduleBlock dow={self.day_of_week} {self.start_time}-{self.end_time}>"
