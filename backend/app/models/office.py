"""Documentos Office privados y sus instantáneas independientes del autoguardado."""
import uuid
from sqlalchemy import ForeignKey, String, Text, Integer, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDPkMixin, TimestampMixin

class OfficeDocument(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "office_documents"
    __table_args__ = (UniqueConstraint("user_id", "import_key"),)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    folder: Mapped[str | None] = mapped_column(String(100), nullable=True)
    import_key: Mapped[str | None] = mapped_column(String(100), nullable=True)

class OfficeDocumentVersion(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "office_document_versions"
    __table_args__ = (UniqueConstraint("document_id", "revision"),)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("office_documents.id", ondelete="CASCADE"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict] = mapped_column(JSON)
