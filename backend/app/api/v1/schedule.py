"""Endpoints de disponibilidad semanal y agenda diaria (Modo Enfoque)."""
from __future__ import annotations

import uuid
from datetime import date as date_type
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.enums import TaskStatus
from app.models.schedule_block import ScheduleBlock
from app.models.task import Task
from app.schemas.schedule import (
    DailyAgenda,
    DailyAgendaItem,
    ScheduleBlockCreate,
    ScheduleBlockRead,
    ScheduleBlockUpdate,
)
from app.services.planner_service import replan_user
from app.services.realtime import notify

router = APIRouter(prefix="/schedule", tags=["schedule"])


# --------------------------------------------------------------------------- #
# Bloques de disponibilidad
# --------------------------------------------------------------------------- #
@router.get("/blocks", response_model=list[ScheduleBlockRead])
async def list_blocks(current_user: CurrentUser, db: DbSession) -> list[ScheduleBlock]:
    result = await db.execute(
        select(ScheduleBlock)
        .where(ScheduleBlock.user_id == current_user.id)
        .order_by(ScheduleBlock.day_of_week, ScheduleBlock.start_time)
    )
    return list(result.scalars().all())


@router.post("/blocks", response_model=ScheduleBlockRead, status_code=status.HTTP_201_CREATED)
async def create_block(
    payload: ScheduleBlockCreate, current_user: CurrentUser, db: DbSession
) -> ScheduleBlock:
    block = ScheduleBlock(user_id=current_user.id, **payload.model_dump())
    db.add(block)
    await db.commit()
    await db.refresh(block)
    notify(current_user.id, "schedule", {"action": "created", "id": str(block.id)})
    return block


@router.patch("/blocks/{block_id}", response_model=ScheduleBlockRead)
async def update_block(
    block_id: uuid.UUID,
    payload: ScheduleBlockUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ScheduleBlock:
    block = await _get_owned_block(db, current_user.id, block_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, field, value)
    await db.commit()
    await db.refresh(block)
    notify(current_user.id, "schedule", {"action": "updated", "id": str(block.id)})
    return block


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_block(
    block_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    block = await _get_owned_block(db, current_user.id, block_id)
    await db.delete(block)
    await db.commit()
    notify(current_user.id, "schedule", {"action": "deleted", "id": str(block_id)})


# --------------------------------------------------------------------------- #
# Agenda diaria
# --------------------------------------------------------------------------- #
@router.get("/today", response_model=DailyAgenda)
async def today(current_user: CurrentUser, db: DbSession) -> DailyAgenda:
    """Agenda del dia actual segun la zona horaria del usuario."""
    tz = ZoneInfo(current_user.timezone or "UTC")
    return await _agenda_for_day(db, current_user, datetime.now(tz=tz).date())


@router.get("/day", response_model=DailyAgenda)
async def day(
    current_user: CurrentUser, db: DbSession, date: date_type | None = None
) -> DailyAgenda:
    """Agenda de una fecha concreta (YYYY-MM-DD)."""
    target = date or datetime.now(tz=ZoneInfo(current_user.timezone or "UTC")).date()
    return await _agenda_for_day(db, current_user, target)


@router.post("/replan", response_model=DailyAgenda)
async def replan(current_user: CurrentUser, db: DbSession) -> DailyAgenda:
    """Recalcula el plan y devuelve la agenda de hoy actualizada."""
    await replan_user(db, current_user)
    notify(current_user.id, "tasks", {"action": "replanned"})
    tz = ZoneInfo(current_user.timezone or "UTC")
    return await _agenda_for_day(db, current_user, datetime.now(tz=tz).date())


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _get_owned_block(
    db: DbSession, user_id: uuid.UUID, block_id: uuid.UUID
) -> ScheduleBlock:
    result = await db.execute(
        select(ScheduleBlock).where(
            ScheduleBlock.id == block_id, ScheduleBlock.user_id == user_id
        )
    )
    block = result.scalar_one_or_none()
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloque no encontrado")
    return block


async def _agenda_for_day(db: DbSession, user, day: date_type) -> DailyAgenda:
    """Construye la agenda de un dia concreto."""
    tz = ZoneInfo(user.timezone or "UTC")
    day_start = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc)
    day_end = datetime.combine(day, time.max, tzinfo=tz).astimezone(timezone.utc)

    result = await db.execute(
        select(Task)
        .options(selectinload(Task.course))
        .where(
            Task.user_id == user.id,
            Task.target_start_at >= day_start,
            Task.target_start_at <= day_end,
            Task.status != TaskStatus.archived,
        )
        .order_by(Task.target_start_at.asc())
    )
    tasks = list(result.scalars().all())

    items: list[DailyAgendaItem] = []
    total_minutes = 0
    completed_minutes = 0
    for task in tasks:
        if task.target_start_at is None or task.target_end_at is None:
            continue
        total_minutes += task.estimated_minutes
        is_done = task.status == TaskStatus.completed
        if is_done:
            completed_minutes += task.estimated_minutes
        items.append(
            DailyAgendaItem(
                task_id=task.id,
                title=task.title,
                course_name=task.course.name if task.course else None,
                priority=task.priority,
                start_at=task.target_start_at,
                end_at=task.target_end_at,
                completed=is_done,
            )
        )

    progress = round((completed_minutes / total_minutes) * 100, 1) if total_minutes else 0.0
    return DailyAgenda(
        day=day,
        items=items,
        total_minutes=total_minutes,
        completed_minutes=completed_minutes,
        progress_percent=progress,
    )
