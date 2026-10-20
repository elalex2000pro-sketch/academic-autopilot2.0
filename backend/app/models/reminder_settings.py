"""Ajustes de recordatorios (Telegram y notificaciones)."""
from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ReminderSettings(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "reminder_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64))
    telegram_token_encrypted: Mapped[str | None] = mapped_column(String(512))
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_hour: Mapped[int] = mapped_column(Integer, default=19, nullable=False)
    last_sent_on: Mapped[date | None] = mapped_column(Date)
