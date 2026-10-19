"""Modelo de usuario."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.ai_output import AiOutput
    from app.models.assistant_message import AssistantMessage
    from app.models.course import Course
    from app.models.document import Document
    from app.models.grade import Grade
    from app.models.integration import Integration
    from app.models.schedule_block import ScheduleBlock
    from app.models.sync_log import SyncLog
    from app.models.task import Task
    from app.models.timetable_entry import TimetableEntry


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)

    # Proveedor de IA elegido por el usuario: local | gemini | openai | claude |
    # openrouter | custom (ver app/services/ai_service.py).
    ai_provider: Mapped[str] = mapped_column(String(16), default="local", nullable=False)
    # Clave de API cifrada (necesaria en los proveedores remotos). Nunca en claro.
    ai_api_key_encrypted: Mapped[str | None] = mapped_column(String(512))
    # Modelo y endpoint personalizados (opcionales; override de los presets).
    ai_model: Mapped[str | None] = mapped_column(String(120))
    ai_base_url: Mapped[str | None] = mapped_column(String(300))

    # Relaciones (cascade para limpieza total al borrar el usuario).
    integrations: Mapped[list["Integration"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    courses: Mapped[list["Course"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    schedule_blocks: Mapped[list["ScheduleBlock"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    grades: Mapped[list["Grade"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    assistant_messages: Mapped[list["AssistantMessage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ai_outputs: Mapped[list["AiOutput"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sync_logs: Mapped[list["SyncLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.email}>"
