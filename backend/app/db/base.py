"""Base declarativa de SQLAlchemy y mixins reutilizables."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """Ahora en UTC con tzinfo (evita datetime naive en PostgreSQL)."""
    return datetime.now(tz=timezone.utc)


class Base(DeclarativeBase):
    """Clase base de todos los modelos ORM."""


class UUIDPkMixin:
    """PK UUID generada en la aplicacion (compatible con Alembic)."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TimestampMixin:
    """Marcas de tiempo de creado/actualizado gestionadas por la BD."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
