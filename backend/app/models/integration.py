"""Modelo de integracion (credenciales de Moodle / Google Classroom)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.enums import IntegrationStatus, Provider

if TYPE_CHECKING:
    from app.models.user import User


class Integration(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_integration_user_provider"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[Provider] = mapped_column(
        SAEnum(Provider, name="provider", native_enum=True), nullable=False
    )
    status: Mapped[IntegrationStatus] = mapped_column(
        SAEnum(IntegrationStatus, name="integration_status", native_enum=True),
        default=IntegrationStatus.connected,
        nullable=False,
    )
    # Solo para Moodle.
    base_url: Mapped[str | None] = mapped_column(String(500))
    # Secretos cifrados (Fernet). Ver app/core/crypto.py.
    token_enc: Mapped[str | None] = mapped_column(String(4096))
    refresh_token_enc: Mapped[str | None] = mapped_column(String(4096))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Metadatos no sensibles: email de Google, site info de Moodle, etc.
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    user: Mapped["User"] = relationship(back_populates="integrations")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Integration {self.provider} user={self.user_id}>"
