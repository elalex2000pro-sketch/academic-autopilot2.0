"""Endpoints de fechas importantes del calendario."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.important_date import ImportantDate
from app.schemas.important_date import ImportantDateCreate, ImportantDateRead
from app.services.realtime import notify

router = APIRouter(prefix="/important-dates", tags=["important-dates"])


@router.get("", response_model=list[ImportantDateRead])
async def list_important_dates(
    current_user: CurrentUser, db: DbSession
) -> list[ImportantDate]:
    result = await db.execute(
        select(ImportantDate)
        .where(ImportantDate.user_id == current_user.id)
        .order_by(ImportantDate.date.asc(), ImportantDate.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ImportantDateRead, status_code=status.HTTP_201_CREATED)
async def create_important_date(
    payload: ImportantDateCreate, current_user: CurrentUser, db: DbSession
) -> ImportantDate:
    event = ImportantDate(user_id=current_user.id, **payload.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    notify(current_user.id, "important_dates", {"action": "created", "id": str(event.id)})
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_important_date(
    event_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    result = await db.execute(
        select(ImportantDate).where(
            ImportantDate.id == event_id,
            ImportantDate.user_id == current_user.id,
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fecha importante no encontrada",
        )
    await db.delete(event)
    await db.commit()
    notify(current_user.id, "important_dates", {"action": "deleted", "id": str(event_id)})
