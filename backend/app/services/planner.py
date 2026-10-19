"""Motor de planificacion inteligente.

Responsabilidad unica: dado un conjunto de tareas y la disponibilidad semanal
del usuario, decidir *cuando* estudiar cada cosa. Es practicamente puro (solo
depende de datos de entrada), lo que lo hace facilmente testeable.

Estrategia (greedy + prioridad):
  1. Clasificar prioridad de cada tarea (urgente / proyecto largo / tarea corta).
  2. Calcular un deadline efectivo con margen de seguridad (por defecto -24h).
  3. Trocear cada tarea en sesiones de 45-90 min.
  4. Generar los huecos libres de las proximas 2 semanas segun `ScheduleBlock`.
  5. Ordenar las sesiones por (deadline efectivo, prioridad) y empaquetarlas
     en el primer hueco disponible que quepa antes del deadline.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.models.enums import TaskPriority

# Orden de prioridad para el empaquetado (menor = mas urgente).
_PRIORITY_RANK: dict[TaskPriority, int] = {
    TaskPriority.urgent: 0,
    TaskPriority.long_project: 1,
    TaskPriority.short_task: 2,
}


# --------------------------------------------------------------------------- #
# Estructuras de datos
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class PlannerTask:
    """Vista simplificada y desacoplada de una tarea para el planner."""

    task_id: object  # uuid.UUID (se tipa como object para no acoplar a SQLAlchemy)
    title: str
    estimated_minutes: int
    due_at: datetime | None = None
    course_name: str | None = None


@dataclass(slots=True)
class AvailabilityBlock:
    """Franja libre semanal (dia local + hora local)."""

    day_of_week: int  # 0=Lunes .. 6=Domingo
    start_time: object  # datetime.time
    end_time: object  # datetime.time


@dataclass(slots=True)
class PlannedSession:
    duration_minutes: int
    start_at: datetime
    end_at: datetime
    order: int


@dataclass(slots=True)
class TaskPlan:
    task_id: object
    title: str
    course_name: str | None
    priority: TaskPriority
    estimated_minutes: int
    due_at: datetime | None
    effective_due_at: datetime | None
    sessions: list[PlannedSession] = field(default_factory=list)

    @property
    def scheduled_minutes(self) -> int:
        return sum(s.duration_minutes for s in self.sessions)

    @property
    def is_fully_scheduled(self) -> bool:
        return self.scheduled_minutes >= self.estimated_minutes


@dataclass(slots=True)
class PlanningResult:
    plans: list[TaskPlan]
    unscheduled_task_ids: list


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def classify_priority(task: PlannerTask, now: datetime, urgency_hours: int = 72) -> TaskPriority:
    """Clasifica una tarea en urgente / proyecto largo / tarea corta."""
    if task.due_at is not None:
        delta = _as_utc(task.due_at) - now
        if delta <= timedelta(hours=urgency_hours):
            return TaskPriority.urgent
    if task.estimated_minutes >= 240:
        return TaskPriority.long_project
    return TaskPriority.short_task


def split_minutes(total: int, max_minutes: int, min_minutes: int) -> list[int]:
    """Trocea `total` minutos en sesiones de tamano entre min y max.

    Evita dejar una ultima sesion mas corta que `min_minutes` absorbiendola
    en la sesion anterior.
    """
    if total <= max_minutes:
        return [max(total, min_minutes)]
    parts: list[int]
    count = math.ceil(total / max_minutes)
    parts = [total // count] * count
    # Repartir el resto (suma exacta).
    for i in range(total % count):
        parts[i] += 1
    # Si la ultima sesion queda por debajo del minimo, fusionarla con la previa.
    if len(parts) > 1 and parts[-1] < min_minutes:
        parts[-2] += parts.pop()
    return parts


def _as_utc(value: datetime) -> datetime:
    """Garantiza que un datetime es timezone-aware en UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def build_free_intervals(
    blocks: list[AvailabilityBlock],
    *,
    now: datetime,
    user_tz: str,
    horizon_days: int,
) -> list[list[datetime]]:
    """Devuelve los huecos libres (UTC) de las proximas `horizon_days`.

    Cada elemento es `[start, end]` en UTC, ya recortado para no empezar antes
    de `now` ni antes del dia de hoy.
    """
    tz = ZoneInfo(user_tz)
    now_local = now.astimezone(tz)
    today_local = now_local.date()
    intervals: list[list[datetime]] = []

    for offset in range(horizon_days):
        current_day: date = today_local + timedelta(days=offset)
        for block in blocks:
            if block.day_of_week != current_day.weekday():
                continue
            local_start = datetime.combine(current_day, block.start_time, tzinfo=tz)
            local_end = datetime.combine(current_day, block.end_time, tzinfo=tz)
            start_utc = local_start.astimezone(timezone.utc)
            end_utc = local_end.astimezone(timezone.utc)
            # Recortar los huecos que ya pasaron.
            start_utc = max(start_utc, now)
            if end_utc > start_utc:
                intervals.append([start_utc, end_utc])

    intervals.sort(key=lambda item: item[0])
    return intervals


# --------------------------------------------------------------------------- #
# Algoritmo principal
# --------------------------------------------------------------------------- #
def build_plan(
    tasks: list[PlannerTask],
    blocks: list[AvailabilityBlock],
    *,
    now: datetime,
    user_tz: str = "UTC",
    safety_margin_hours: int = 24,
    max_session_minutes: int = 90,
    min_session_minutes: int = 30,
    horizon_days: int = 14,
) -> PlanningResult:
    """Calcula el plan completo de estudio."""
    now = _as_utc(now)
    margin = timedelta(hours=safety_margin_hours)
    intervals = build_free_intervals(
        blocks, now=now, user_tz=user_tz, horizon_days=horizon_days
    )
    horizon_end = now + timedelta(days=horizon_days)

    # 1-3. Preparar planes y sesiones.
    plans: list[TaskPlan] = []
    demands: list[tuple[tuple, TaskPlan, int]] = []  # (clave de orden, plan, minutos)
    for task in tasks:
        priority = classify_priority(task, now)
        effective_due = (
            _as_utc(task.due_at) - margin if task.due_at is not None else None
        )
        plan = TaskPlan(
            task_id=task.task_id,
            title=task.title,
            course_name=task.course_name,
            priority=priority,
            estimated_minutes=task.estimated_minutes,
            due_at=_as_utc(task.due_at) if task.due_at else None,
            effective_due_at=effective_due,
        )
        plans.append(plan)
        for order, minutes in enumerate(
            split_minutes(task.estimated_minutes, max_session_minutes, min_session_minutes)
        ):
            sort_deadline = effective_due or horizon_end
            sort_key = (sort_deadline, _PRIORITY_RANK[priority], order)
            demands.append((sort_key, plan, minutes))

    # 4-5. Empaquetado greedy.
    demands.sort(key=lambda item: item[0])
    unscheduled: set = set()

    for _, plan, minutes in demands:
        deadline = plan.effective_due_at or horizon_end
        duration = timedelta(minutes=minutes)
        placed = False
        for index, (slot_start, slot_end) in enumerate(intervals):
            # No programar en el pasado.
            if slot_start < now:
                continue
            # Si ni empezando ahora cabria antes del deadline, los siguientes
            # huecos (mas tardios) tampoco: cortamos.
            if slot_start + duration > min(slot_end, deadline):
                if slot_start >= deadline - duration:
                    break
                continue
            session_end = slot_start + duration
            plan.sessions.append(
                PlannedSession(
                    duration_minutes=minutes,
                    start_at=slot_start,
                    end_at=session_end,
                    order=len(plan.sessions),
                )
            )
            # Reducir el hueco consumido y mantener orden.
            if session_end < slot_end:
                intervals[index] = [session_end, slot_end]
            else:
                intervals.pop(index)
            placed = True
            break
        if not placed:
            unscheduled.add(plan.task_id)

    return PlanningResult(
        plans=plans,
        unscheduled_task_ids=[tid for tid in unscheduled],
    )
