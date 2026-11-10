"""Tareas y trabajo personal entre compañeros, sin roles docentes."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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

    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_topics.id", ondelete="SET NULL"), index=True
    )

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

    state: Mapped[str] = mapped_column(
        String(20), default="pending", server_default="pending", nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text)
    shared: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    assignment: Mapped["ClassAssignment"] = relationship(back_populates="completions")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassAssignmentCompletion assignment={self.assignment_id}>"


class ClassTopic(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "class_topics"
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shared_classes.id", ondelete="CASCADE"), index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(200))
    order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class ClassWorkFile(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "class_work_files"
    work_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("class_assignment_completions.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300))
    storage_path: Mapped[str] = mapped_column(String(1000))
    size: Mapped[int] = mapped_column(Integer)


class ClassAssignmentAttachment(UUIDPkMixin, Base):
    __tablename__ = "class_assignment_attachments"
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_assignments.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE")
    )


class ClassWorkComment(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "class_work_comments"
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_assignments.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
