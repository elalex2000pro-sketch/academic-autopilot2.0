"""Servicio de planificacion: conecta el planner puro con la base de datos."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.course import Course
from app.models.enums import SourcePlatform, TaskPriority, TaskStatus
from app.models.schedule_block import ScheduleBlock
from app.models.task import Task
from app.models.user import User
from app.services.planner import (
    AvailabilityBlock,
    PlannerTask,
    PlanningResult,
    build_plan,
)

logger = get_logger(__name__)

_HORIZON_DAYS = 14


async def replan_user(session: AsyncSession, user: User, *, now: datetime | None = None) -> PlanningResult:
    """Recalcula y persiste el plan completo de un usuario."""
    now = now or utcnow()

    # 1. Tareas de primer nivel pendientes (las subtareas las regeneramos).
    result = await session.execute(
        select(Task).where(
            Task.user_id == user.id,
            Task.parent_task_id.is_(None),
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
    )
    tasks = list(result.scalars().all())

    # Mapa de nombres de curso para mostrar en la UI.
    course_names = await _course_name_map(session, user.id)

    planner_tasks = [
        PlannerTask(
            task_id=t.id,
            title=t.title,
            estimated_minutes=t.estimated_minutes,
            due_at=t.due_at,
            course_name=course_names.get(t.course_id) if t.course_id else None,
        )
        for t in tasks
    ]

    blocks = await _availability_blocks(session, user.id)

    plan = build_plan(
        planner_tasks,
        blocks,
        now=now,
        user_tz=user.timezone or "UTC",
        safety_margin_hours=settings.safety_margin_hours,
        max_session_minutes=settings.max_session_minutes,
        min_session_minutes=settings.min_session_minutes,
        horizon_days=_HORIZON_DAYS,
    )

    await _persist_plan(session, user, tasks, plan)
    await session.commit()
    logger.info(
        "Plan recalculado para %s: %d tareas, %d sin programar",
        user.email,
        len(plan.plans),
        len(plan.unscheduled_task_ids),
    )
    return plan


async def _persist_plan(
    session: AsyncSession,
    user: User,
    parents: list[Task],
    plan: PlanningResult,
) -> None:
    """Escribe el resultado: subtareas nuevas + ventanas objetivo."""
    parent_by_id = {t.id: t for t in parents}

    # Limpiar subtareas y ventanas anteriores de los padres planificados.
    parent_ids = [t.id for t in parents]
    if parent_ids:
        await session.execute(delete(Task).where(Task.parent_task_id.in_(parent_ids)))
    for parent in parents:
        parent.target_start_at = None
        parent.target_end_at = None

    for task_plan in plan.plans:
        parent = parent_by_id.get(task_plan.task_id)
        if parent is None:
            continue

        sessions = sorted(task_plan.sessions, key=lambda s: s.start_at)
        if not sessions:
            continue

        if len(sessions) == 1:
            # Una sola sesion: se agenda la tarea original.
            parent.target_start_at = sessions[0].start_at
            parent.target_end_at = sessions[0].end_at
            continue

        # Multiples sesiones: se divide en subtareas distribuidas.
        if parent.status == TaskStatus.pending:
            parent.status = TaskStatus.in_progress
        for index, planned in enumerate(sessions, start=1):
            subtask = Task(
                user_id=user.id,
                course_id=parent.course_id,
                source=SourcePlatform.manual,
                external_id=f"plan-{parent.id}-{index}",
                title=f"{parent.title} (Parte {index}/{len(sessions)})",
                description=parent.description,
                due_at=parent.due_at,
                estimated_minutes=planned.duration_minutes,
                priority=task_plan.priority,
                status=TaskStatus.pending,
                parent_task_id=parent.id,
                target_start_at=planned.start_at,
                target_end_at=planned.end_at,
            )
            session.add(subtask)
        # El padre pasa a ser un contenedor sin ventana directa: su horario se
        # representa con las subtareas, evitando doble conteo en la agenda.
        parent.target_start_at = None
        parent.target_end_at = None


async def _course_name_map(session: AsyncSession, user_id: uuid.UUID) -> dict:
    result = await session.execute(select(Course.id, Course.name).where(Course.user_id == user_id))
    return {row.id: row.name for row in result.all()}


async def _availability_blocks(session: AsyncSession, user_id: uuid.UUID) -> list[AvailabilityBlock]:
    result = await session.execute(
        select(ScheduleBlock).where(
            ScheduleBlock.user_id == user_id,
            ScheduleBlock.is_active.is_(True),
        )
    )
    return [
        AvailabilityBlock(
            day_of_week=b.day_of_week,
            start_time=b.start_time,
            end_time=b.end_time,
        )
        for b in result.scalars().all()
    ]
