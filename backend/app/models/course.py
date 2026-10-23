"""Modelo de asignatura/curso, normalizado entre plataformas."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.enums import SourcePlatform

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.grade import Grade
    from app.models.task import Task
    from app.models.timetable_entry import TimetableEntry
    from app.models.user import User


class Course(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("user_id", "source", "external_id", name="uq_course_user_source_ext"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[SourcePlatform] = mapped_column(
        SAEnum(SourcePlatform, name="source_platform", native_enum=True), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    code: Mapped[str | None] = mapped_column(String(120))
    color: Mapped[str | None] = mapped_column(String(16))
    # Profesor/a de la asignatura. Puede venir vacio en cursos sincronizados.
    teacher: Mapped[str | None] = mapped_column(String(200))

    user: Mapped["User"] = relationship(back_populates="courses")
    tasks: Mapped[list["Task"]] = relationship(back_populates="course")
    grades: Mapped[list["Grade"]] = relationship(back_populates="course")
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="course"
    )
    documents: Mapped[list["Document"]] = relationship(back_populates="course")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Course {self.name}>"
