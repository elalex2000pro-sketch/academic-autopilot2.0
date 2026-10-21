"""Utilidades compartidas de clases compartidas (miembros y notificaciones)."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shared_class import ClassMembership
from app.services.realtime import notify


async def member_ids(db: AsyncSession, class_id: uuid.UUID) -> list[uuid.UUID]:
    """Devuelve los ids de usuario de todos los miembros de una clase."""
    result = await db.execute(
        select(ClassMembership.user_id).where(ClassMembership.class_id == class_id)
    )
    return [row[0] for row in result.all()]


async def notify_class(
    db: AsyncSession, class_id: uuid.UUID, action: str, **extra: Any
) -> None:
    """Avisa en tiempo real a todos los miembros de la clase."""
    data = {"class_id": str(class_id), "action": action, **extra}
    for user_id in await member_ids(db, class_id):
        notify(user_id, "classes", data)
