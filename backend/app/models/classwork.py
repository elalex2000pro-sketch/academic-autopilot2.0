"""Trabajo de clase: tareas con fecha y seguimiento de entregas.

Inspirado en la pagina "Trabajo" de Google Classroom: el propietario publica
tareas y cada miembro marca la suya como hecha. No sustituye a las tareas
personales del planificador: es el acuerdo visible de la clase.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ClassAssignment(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "class_assignments"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shared_classes.id", ondelete="CASCADE"), index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    completions: Mapped[list["ClassAssignmentCompletion"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassAssignment {self.title!r}>"


class ClassAssignmentCompletion(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "class_assignment_completions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "user_id", name="uq_assignment_completion"),
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("class_assignments.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    assignment: Mapped["ClassAssignment"] = relationship(back_populates="completions")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassAssignmentCompletion assignment={self.assignment_id}>"
