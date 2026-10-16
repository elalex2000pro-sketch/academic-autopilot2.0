"""Modelo de tarea (incluye subtareas del planificador)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.enums import SourcePlatform, TaskPriority, TaskStatus

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Task(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "external_id", name="uq_task_user_source_ext"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    source: Mapped[SourcePlatform] = mapped_column(
        SAEnum(SourcePlatform, name="source_platform", native_enum=True), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    # Fecha limite real reportada por la plataforma.
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority", native_enum=True),
        default=TaskPriority.short_task,
        nullable=False,
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status", native_enum=True),
        default=TaskStatus.pending,
        nullable=False,
    )

    # Bloque asignado por el motor de planificacion.
    target_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    target_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Jerarquia: una subtarea apunta a su tarea padre.
    parent_task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )

    user: Mapped["User"] = relationship(back_populates="tasks")
    course: Mapped["Course | None"] = relationship(back_populates="tasks")
    subtasks: Mapped[list["Task"]] = relationship(
        back_populates="parent_task", cascade="all, delete-orphan"
    )
    parent_task: Mapped["Task | None"] = relationship(
        back_populates="subtasks", remote_side="Task.id"
    )

    @property
    def is_subtask(self) -> bool:
        return self.parent_task_id is not None

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Task {self.title!r} status={self.status}>"
