"""Cuaderno de notas del usuario (contenido libre por cuaderno)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.document import Document
    from app.models.user import User


class Notebook(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "notebooks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Comparticion con una clase (una clase por cuaderno; lectura o edicion).
    shared_class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shared_classes.id", ondelete="SET NULL"), index=True
    )
    share_permission: Mapped[str] = mapped_column(String(10), default="read", nullable=False)

    user: Mapped["User"] = relationship()
    sources: Mapped[list["NotebookSource"]] = relationship(
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="NotebookSource.created_at",
    )


class NotebookSource(UUIDPkMixin, TimestampMixin, Base):
    """Libro o archivo elegido como fuente de un cuaderno (estilo NotebookLM).

    Exactamente uno de `book_id` o `document_id` está presente. Al borrar el
    libro o el archivo, la fuente desaparece del cuaderno; el texto del libro
    sigue en la biblioteca mientras el libro exista.
    """

    __tablename__ = "notebook_sources"
    __table_args__ = (
        UniqueConstraint("notebook_id", "book_id", name="uq_notebook_source_book"),
        UniqueConstraint("notebook_id", "document_id", name="uq_notebook_source_document"),
    )

    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("notebooks.id", ondelete="CASCADE"), index=True
    )
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    added_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    notebook: Mapped["Notebook"] = relationship(back_populates="sources")
    book: Mapped["Book | None"] = relationship()
    document: Mapped["Document | None"] = relationship()
