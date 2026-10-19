"""Modelos de clases compartidas: grupos con codigo permanente, chat, calendario
conjunto y archivos compartidos."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from app.models.user import User


class SharedClass(UUIDPkMixin, TimestampMixin, Base):
    """Clase compartida: un grupo permanente al que se entra con un codigo."""

    __tablename__ = "shared_classes"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Codigo permanente de union: no caduca (el propietario puede regenerarlo).
    code: Mapped[str] = mapped_column(
        String(12), unique=True, index=True, nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    memberships: Mapped[list["ClassMembership"]] = relationship(
        back_populates="shared_class", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ClassMessage"]] = relationship(
        back_populates="shared_class", cascade="all, delete-orphan"
    )
    events: Mapped[list["ClassEvent"]] = relationship(
        back_populates="shared_class", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SharedClass {self.name!r} code={self.code}>"


class ClassMembership(UUIDPkMixin, TimestampMixin, Base):
    """Pertenencia (permanente) de un usuario a una clase compartida."""

    __tablename__ = "class_memberships"
    __table_args__ = (
        UniqueConstraint("class_id", "user_id", name="uq_class_membership"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_classes.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # "owner" (quien creo la clase) o "member" (el resto).
    role: Mapped[str] = mapped_column(String(16), default="member", nullable=False)

    shared_class: Mapped["SharedClass"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassMembership class={self.class_id} user={self.user_id}>"


class ClassMessage(UUIDPkMixin, TimestampMixin, Base):
    """Mensaje del chat de una clase compartida (o anuncio fijado)."""

    __tablename__ = "class_messages"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_classes.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # "message" (chat normal) o "announcement" (anuncio del propietario).
    kind: Mapped[str] = mapped_column(String(16), default="message", nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    shared_class: Mapped["SharedClass"] = relationship(back_populates="messages")
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassMessage class={self.class_id} kind={self.kind}>"


class ClassEvent(UUIDPkMixin, TimestampMixin, Base):
    """Evento del calendario conjunto de una clase compartida."""

    __tablename__ = "class_events"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shared_classes.id", ondelete="CASCADE"),
        index=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(200))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    shared_class: Mapped["SharedClass"] = relationship(back_populates="events")
    creator: Mapped["User"] = relationship()

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ClassEvent {self.title!r} {self.start_at}>"
