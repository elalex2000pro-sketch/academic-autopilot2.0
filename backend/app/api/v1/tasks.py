"""Endpoints de tareas: CRUD, completado y plan optimizado."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.course import Course
from app.models.enums import SourcePlatform, TaskPriority, TaskStatus
from app.models.task import Task
from app.schemas.task import (
    OptimizedPlan,
    OptimizedPlanItem,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from app.services.planner_service import replan_user
from app.services.realtime import notify

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/optimized", response_model=OptimizedPlan)
async def optimized_plan(current_user: CurrentUser, db: DbSession) -> OptimizedPlan:
    """Recalcula el plan y devuelve las sesiones calendarizadas.

    Es un endpoint de lectura: NO emite eventos en tiempo real para evitar que
    los clientes que refrescan al recibirlos entren en un bucle de peticiones.
    """
    plan = await replan_user(db, current_user)
    return await _build_optimized_plan(db, current_user, plan.unscheduled_task_ids)


@router.post("/replan", response_model=OptimizedPlan)
async def replan(current_user: CurrentUser, db: DbSession) -> OptimizedPlan:
    """Fuerza un recalculo del plan sin sincronizar fuentes externas."""
    plan = await replan_user(db, current_user)
    notify(current_user.id, "tasks", {"action": "replanned"})
    return await _build_optimized_plan(db, current_user, plan.unscheduled_task_ids)


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    current_user: CurrentUser,
    db: DbSession,
    task_status: TaskStatus | None = Query(default=None, alias="status"),
    course_id: uuid.UUID | None = None,
) -> list[Task]:
    """Lista tareas con filtros opcionales por estado y curso."""
    stmt = select(Task).where(Task.user_id == current_user.id)
    if task_status is not None:
        stmt = stmt.where(Task.status == task_status)
    else:
        stmt = stmt.where(Task.status != TaskStatus.archived)
    if course_id is not None:
        stmt = stmt.where(Task.course_id == course_id)
    stmt = stmt.order_by(Task.due_at.asc().nulls_last(), Task.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, current_user: CurrentUser, db: DbSession) -> Task:
    """Crea una tarea manual."""
    task = Task(
        user_id=current_user.id,
        course_id=payload.course_id,
        source=SourcePlatform.manual,
        external_id=f"manual-{uuid.uuid4()}",
        title=payload.title,
        description=payload.description,
        due_at=payload.due_at,
        estimated_minutes=payload.estimated_minutes,
        priority=payload.priority or _guess_priority(payload.due_at),
        status=TaskStatus.pending,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    notify(current_user.id, "tasks", {"action": "created", "id": str(task.id)})
    return task


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Task:
    return await _get_owned_task(db, current_user.id, task_id)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, current_user: CurrentUser, db: DbSession
) -> Task:
    task = await _get_owned_task(db, current_user.id, task_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    notify(current_user.id, "tasks", {"action": "updated", "id": str(task.id)})
    return task


@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete_task(task_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Task:
    """Marca una tarea como completada (y sus subtareas pendientes si las tiene)."""
    task = await _get_owned_task(db, current_user.id, task_id)
    task.status = TaskStatus.completed

    # Si el planificador dividio la tarea en subtareas, se completan tambien
    # las que sigan pendientes para no dejar "partes" sueltas en la agenda.
    result = await db.execute(
        select(Task).where(
            Task.parent_task_id == task.id,
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
    )
    for subtask in result.scalars().all():
        subtask.status = TaskStatus.completed

    await db.commit()
    await db.refresh(task)
    notify(current_user.id, "tasks", {"action": "completed", "id": str(task.id)})
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_task(task_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    task = await _get_owned_task(db, current_user.id, task_id)
    await db.delete(task)
    await db.commit()
    notify(current_user.id, "tasks", {"action": "deleted", "id": str(task_id)})


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _get_owned_task(db: DbSession, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")
    return task


def _guess_priority(due_at: datetime | None) -> TaskPriority:
    if due_at is None:
        return TaskPriority.short_task
    now = datetime.now(tz=timezone.utc)
    due = due_at if due_at.tzinfo else due_at.replace(tzinfo=timezone.utc)
    margin = timedelta(hours=settings.safety_margin_hours)
    if due - now <= timedelta(days=3):
        return TaskPriority.urgent
    return TaskPriority.short_task


async def _build_optimized_plan(
    db: DbSession, user, unscheduled_ids: list
) -> OptimizedPlan:
    """Construye el DTO del plan a partir de las tareas con ventana asignada."""
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.course))
        .where(
            Task.user_id == user.id,
            Task.target_start_at.is_not(None),
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
        .order_by(Task.target_start_at.asc())
    )
    tasks = list(result.scalars().all())

    items: list[OptimizedPlanItem] = []
    total = 0
    margin = timedelta(hours=settings.safety_margin_hours)
    for task in tasks:
        if task.target_start_at is None or task.target_end_at is None:
            continue
        total += task.estimated_minutes
        items.append(
            OptimizedPlanItem(
                task_id=task.id,
                parent_task_id=task.parent_task_id,
                title=task.title,
                course_name=task.course.name if task.course else None,
                priority=task.priority,
                estimated_minutes=task.estimated_minutes,
                due_at=task.due_at,
                effective_due_at=(task.due_at - margin if task.due_at else None),
                start_at=task.target_start_at,
                end_at=task.target_end_at,
            )
        )

    return OptimizedPlan(
        generated_at=datetime.now(tz=timezone.utc),
        scheduled=items,
        unscheduled_task_ids=[uuid.UUID(str(x)) for x in unscheduled_ids],
        total_scheduled_minutes=total,
    )
