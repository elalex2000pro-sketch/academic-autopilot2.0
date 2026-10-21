"""Modelo de sesion de subida por trozos (archivos grandes y reanudables)."""
from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class UploadSession(UUIDPkMixin, TimestampMixin, Base):
    """Subida en curso (o finalizada) de un archivo por trozos.

    El archivo se escribe incrementalmente en `storage_path + ".part"`; al
    completarse se renombra a `storage_path` y se crea el `Document`.
    El estado (`received_bytes`) permite reanudar una subida interrumpida.
    """

    __tablename__ = "upload_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), index=True
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_classes.id", ondelete="SET NULL"),
        index=True,
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )

    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(200), default="application/octet-stream"
    )
    # Tamano total declarado por el cliente (bytes).
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Bytes ya recibidos y persistidos en el fichero temporal.
    received_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    chunk_size: Mapped[int] = mapped_column(Integer, nullable=False)
    # pending | completed | aborted
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # Ruta relativa final (dentro de FILES_DIR) que usara el Document.
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<UploadSession {self.filename!r} {self.received_bytes}/{self.size_bytes}>"
        )
