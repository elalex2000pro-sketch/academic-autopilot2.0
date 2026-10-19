"""Endpoints del horario semanal (clases recurrentes)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.timetable_entry import TimetableEntry
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
)
from app.services.realtime import notify

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("", response_model=list[TimetableEntryRead])
async def list_entries(current_user: CurrentUser, db: DbSession) -> list[TimetableEntry]:
    result = await db.execute(
        select(TimetableEntry)
        .where(TimetableEntry.user_id == current_user.id)
        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
    )
    return list(result.scalars().all())


@router.post("", response_model=TimetableEntryRead, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: TimetableEntryCreate, current_user: CurrentUser, db: DbSession
) -> TimetableEntry:
    entry = TimetableEntry(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    notify(current_user.id, "timetable", {"action": "created", "id": str(entry.id)})
    return entry


@router.patch("/{entry_id}", response_model=TimetableEntryRead)
async def update_entry(
    entry_id: uuid.UUID,
    payload: TimetableEntryUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> TimetableEntry:
    entry = await _get_owned_entry(db, current_user.id, entry_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    notify(current_user.id, "timetable", {"action": "updated", "id": str(entry.id)})
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_entry(
    entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    entry = await _get_owned_entry(db, current_user.id, entry_id)
    await db.delete(entry)
    await db.commit()
    notify(current_user.id, "timetable", {"action": "deleted", "id": str(entry_id)})


async def _get_owned_entry(
    db: DbSession, user_id: uuid.UUID, entry_id: uuid.UUID
) -> TimetableEntry:
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == entry_id, TimetableEntry.user_id == user_id
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada")
    return entry
