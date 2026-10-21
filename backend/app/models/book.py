"""Biblioteca personal de libros completos y su progreso de lectura.

El texto extraido se guarda por secciones en la base de datos para que un libro
siga siendo consultable aunque el archivo original desaparezca del disco (por
ejemplo, tras un redespliegue de Render). El archivo original se conserva como
Document y se puede descargar desde Archivos.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.course import Course


class Book(UUIDPkMixin, TimestampMixin, Base):
    """Un libro completo (PDF, EPUB, DOCX, TXT o Markdown) del usuario."""

    __tablename__ = "books"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), index=True
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str | None] = mapped_column(String(300))
    format: Mapped[str] = mapped_column(String(20), default="pdf", nullable=False)
    cover_color: Mapped[str] = mapped_column(String(20), default="#6366f1", nullable=False)

    # processing -> ready | error. La interfaz hace polling mientras procesa.
    status: Mapped[str] = mapped_column(String(20), default="processing", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)

    total_sections: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_section_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    source_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    sections: Mapped[list["BookSection"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="BookSection.section_index",
    )
    messages: Mapped[list["BookMessage"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    course: Mapped["Course | None"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Book {self.title!r} status={self.status}>"


class BookSection(UUIDPkMixin, TimestampMixin, Base):
    """Una seccion legible del libro (capitulo, pagina o bloque de texto)."""

    __tablename__ = "book_sections"
    __table_args__ = (
        UniqueConstraint("book_id", "section_index", name="uq_book_section_index"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True
    )
    section_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)

    book: Mapped["Book"] = relationship(back_populates="sections")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<BookSection {self.section_index} {self.title!r}>"


class BookMessage(UUIDPkMixin, TimestampMixin, Base):
    """Historial del chat con un libro (preguntas, respuestas y citas)."""

    __tablename__ = "book_messages"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="ai", nullable=False)

    book: Mapped["Book"] = relationship(back_populates="messages")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<BookMessage {self.role} book={self.book_id}>"
