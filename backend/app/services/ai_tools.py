"""Herramientas (tool calling) que permiten a la IA operar sobre la app.

La IA puede consultar y modificar los datos del estudiante: asignaturas, tareas,
notas, horario y disponibilidad. Las herramientas marcadas como destructivas NO
se ejecutan directamente: se devuelven al cliente para que el usuario confirme.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.course import Course
from app.models.enums import SourcePlatform, TaskPriority, TaskStatus
from app.models.grade import Grade
from app.models.schedule_block import ScheduleBlock
from app.models.task import Task
from app.models.timetable_entry import TimetableEntry
from app.models.user import User

logger = get_logger(__name__)

_DAYS = {
    "lunes": 0, "martes": 1, "miercoles": 2, "miércoles": 2, "jueves": 3,
    "viernes": 4, "sabado": 5, "sábado": 5, "domingo": 6,
}

# Herramientas que requieren confirmacion del usuario antes de ejecutarse.
DESTRUCTIVE: set[str] = {"delete_task", "delete_course", "delete_timetable_entry", "delete_grade"}


def tool_schemas() -> list[dict[str, Any]]:
    """Definiciones de herramientas en formato OpenAI (compatible con Ollama)."""
    return [
        {
            "type": "function",
            "function": {
                "name": "list_courses",
                "description": "Lista las asignaturas del estudiante.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_course",
                "description": "Crea una asignatura nueva.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Nombre de la asignatura"},
                        "code": {"type": "string", "description": "Codigo opcional (ej. MAT101)"},
                        "color": {"type": "string", "description": "Color hex opcional (ej. #3B82F6)"},
                    },
                    "required": ["name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_course",
                "description": "Elimina una asignatura por su nombre. Requiere confirmacion.",
                "parameters": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}},
                    "required": ["name"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_tasks",
                "description": "Lista las tareas del estudiante (pendientes por defecto).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["pending", "in_progress", "completed", "all"],
                        },
                        "course_name": {"type": "string"},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Crea una tarea con fecha de entrega y tiempo estimado.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "due_at": {"type": "string", "description": "Fecha/hora ISO, ej. 2026-05-10 o 2026-05-10T18:00"},
                        "estimated_minutes": {"type": "integer"},
                        "course_name": {"type": "string"},
                        "priority": {"type": "string", "enum": ["urgent", "long_project", "short_task"]},
                    },
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_task",
                "description": "Actualiza una tarea existente (por titulo).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_title": {"type": "string", "description": "Titulo (o parte) de la tarea a actualizar"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "due_at": {"type": "string"},
                        "estimated_minutes": {"type": "integer"},
                        "priority": {"type": "string", "enum": ["urgent", "long_project", "short_task"]},
                        "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                    },
                    "required": ["task_title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "complete_task",
                "description": "Marca una tarea como completada (por titulo).",
                "parameters": {
                    "type": "object",
                    "properties": {"task_title": {"type": "string"}},
                    "required": ["task_title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_task",
                "description": "Elimina una tarea por su titulo. Requiere confirmacion.",
                "parameters": {
                    "type": "object",
                    "properties": {"task_title": {"type": "string"}},
                    "required": ["task_title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_grades",
                "description": "Lista las notas, opcionalmente filtradas por asignatura.",
                "parameters": {
                    "type": "object",
                    "properties": {"course_name": {"type": "string"}},
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "add_grade",
                "description": "Anade una nota (examen, practica, trabajo...).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "course_name": {"type": "string"},
                        "score": {"type": "number", "description": "Nota obtenida"},
                        "max_score": {"type": "number", "description": "Nota maxima (por defecto 10)"},
                        "weight": {"type": "number", "description": "Peso/porcentaje en la nota final"},
                        "graded_at": {"type": "string", "description": "Fecha ISO, ej. 2026-05-10"},
                        "notes": {"type": "string"},
                    },
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_grade",
                "description": "Elimina una nota por su titulo. Requiere confirmacion.",
                "parameters": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_timetable",
                "description": "Lista las clases del horario semanal.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "add_timetable_entry",
                "description": "Anade una clase recurrente al horario semanal.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day_of_week": {"type": "integer", "description": "0=Lunes .. 6=Domingo"},
                        "start_time": {"type": "string", "description": "HH:MM"},
                        "end_time": {"type": "string", "description": "HH:MM"},
                        "title": {"type": "string"},
                        "course_name": {"type": "string"},
                        "location": {"type": "string"},
                    },
                    "required": ["day_of_week", "start_time", "end_time"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_timetable_entry",
                "description": "Elimina una clase del horario por asignatura/titulo. Requiere confirmacion.",
                "parameters": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                    "required": ["title"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "add_availability",
                "description": "Anade una franja de disponibilidad semanal para estudiar.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day_of_week": {"type": "integer", "description": "0=Lunes .. 6=Domingo"},
                        "start_time": {"type": "string", "description": "HH:MM"},
                        "end_time": {"type": "string", "description": "HH:MM"},
                        "label": {"type": "string"},
                    },
                    "required": ["day_of_week", "start_time", "end_time"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_plan",
                "description": "Devuelve el plan de estudio actual (sesiones programadas).",
                "parameters": {"type": "object", "properties": {}},
            },
        },
    ]


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def _parse_day(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 6 else None
    if isinstance(value, str):
        v = value.strip().lower()
        if v.isdigit():
            n = int(v)
            return n if 0 <= n <= 6 else None
        return _DAYS.get(v)
    return None


def _parse_time(value: Any) -> time | None:
    if not isinstance(value, str):
        return None
    try:
        parts = value.strip().replace("h", ":").split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour=hour, minute=minute)
    except (ValueError, IndexError):
        return None


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        try:
            dt = datetime.combine(date.fromisoformat(text[:10]), time(23, 59))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_date(value: Any) -> date | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def _guess_priority(due_at: datetime | None) -> TaskPriority:
    if due_at is None:
        return TaskPriority.short_task
    due = due_at if due_at.tzinfo else due_at.replace(tzinfo=timezone.utc)
    if due - datetime.now(tz=timezone.utc) <= timedelta(days=3):
        return TaskPriority.urgent
    return TaskPriority.short_task


async def _resolve_course(
    db: AsyncSession, user: User, name: str | None, create_if_missing: bool = True
) -> Course | None:
    if not name or not name.strip():
        return None
    q = name.strip()
    result = await db.execute(
        select(Course).where(Course.user_id == user.id).order_by(Course.name)
    )
    courses = list(result.scalars().all())
    exact = [c for c in courses if c.name.lower() == q.lower()]
    if exact:
        return exact[0]
    partial = [c for c in courses if q.lower() in c.name.lower()]
    if partial:
        return partial[0]
    if not create_if_missing:
        return None
    # No existe: la creamos para poder vincular el elemento (comodo para el usuario).
    course = Course(
        user_id=user.id,
        source=SourcePlatform.manual,
        external_id=f"manual-{uuid.uuid4()}",
        name=q[:500],
    )
    db.add(course)
    await db.flush()
    return course


async def _find_task(db: AsyncSession, user: User, title: str) -> tuple[Task | None, list[Task]]:
    q = (title or "").strip()
    result = await db.execute(
        select(Task)
        .where(Task.user_id == user.id, Task.status != TaskStatus.archived)
        .order_by(Task.created_at.desc())
    )
    tasks = list(result.scalars().all())
    exact = [t for t in tasks if t.title.lower() == q.lower()]
    if len(exact) == 1:
        return exact[0], []
    partial = [t for t in tasks if q.lower() in t.title.lower()]
    if len(partial) == 1:
        return partial[0], []
    return None, partial or exact


async def _find_grade(db: AsyncSession, user: User, title: str) -> tuple[Grade | None, list[Grade]]:
    q = (title or "").strip()
    result = await db.execute(select(Grade).where(Grade.user_id == user.id))
    grades = list(result.scalars().all())
    exact = [g for g in grades if g.title.lower() == q.lower()]
    if len(exact) == 1:
        return exact[0], []
    partial = [g for g in grades if q.lower() in g.title.lower()]
    if len(partial) == 1:
        return partial[0], []
    return None, partial or exact


# --------------------------------------------------------------------------- #
# Ejecucion
# --------------------------------------------------------------------------- #
async def execute_tool(
    db: AsyncSession, user: User, name: str, args: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    """Ejecuta una herramienta. Devuelve (resultado, eventos de tiempo real)."""
    handler = _HANDLERS.get(name)
    if handler is None:
        return {"ok": False, "error": f"Herramienta desconocida: {name}"}, []
    try:
        return await handler(db, user, args)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Fallo al ejecutar la herramienta %s: %s", name, exc)
        await db.rollback()
        return {"ok": False, "error": str(exc)}, []


async def _h_list_courses(db, user, args) -> tuple[dict, list[str]]:
    result = await db.execute(select(Course).where(Course.user_id == user.id).order_by(Course.name))
    courses = list(result.scalars().all())
    return (
        {"ok": True, "courses": [{"name": c.name, "code": c.code} for c in courses]},
        [],
    )


async def _h_create_course(db, user, args) -> tuple[dict, list[str]]:
    name = str(args.get("name", "")).strip()
    if not name:
        return {"ok": False, "error": "Falta el nombre de la asignatura"}, []
    course = Course(
        user_id=user.id,
        source=SourcePlatform.manual,
        external_id=f"manual-{uuid.uuid4()}",
        name=name[:500],
        code=(args.get("code") or None),
        color=(args.get("color") or None),
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return {"ok": True, "created": course.name, "id": str(course.id)}, ["courses"]


async def _h_delete_course(db, user, args) -> tuple[dict, list[str]]:
    name = str(args.get("name", "")).strip()
    course = await _resolve_course(db, user, name, create_if_missing=False)
    if course is None or name.lower() not in course.name.lower():
        return {"ok": False, "error": f"No encontre la asignatura '{name}'"}, []
    deleted = course.name
    await db.delete(course)
    await db.commit()
    return {"ok": True, "deleted": deleted}, ["courses", "tasks", "grades", "timetable"]


async def _h_list_tasks(db, user, args) -> tuple[dict, list[str]]:
    stmt = select(Task).where(Task.user_id == user.id, Task.parent_task_id.is_(None))
    status = str(args.get("status") or "pending")
    if status != "all":
        try:
            stmt = stmt.where(Task.status == TaskStatus(status))
        except ValueError:
            stmt = stmt.where(Task.status == TaskStatus.pending)
    else:
        stmt = stmt.where(Task.status != TaskStatus.archived)
    course_name = args.get("course_name")
    if course_name:
        course = await _resolve_course(db, user, str(course_name), create_if_missing=False)
        if course is not None:
            stmt = stmt.where(Task.course_id == course.id)
    stmt = stmt.order_by(Task.due_at.asc().nulls_last())
    result = await db.execute(stmt)
    tasks = list(result.scalars().all())
    course_ids = {t.course_id for t in tasks if t.course_id}
    names: dict[uuid.UUID, str] = {}
    if course_ids:
        cres = await db.execute(select(Course).where(Course.id.in_(course_ids)))
        names = {c.id: c.name for c in cres.scalars().all()}
    return (
        {
            "ok": True,
            "tasks": [
                {
                    "title": t.title,
                    "course": names.get(t.course_id) if t.course_id else None,
                    "due_at": t.due_at.isoformat() if t.due_at else None,
                    "estimated_minutes": t.estimated_minutes,
                    "priority": t.priority.value,
                    "status": t.status.value,
                }
                for t in tasks
            ],
        },
        [],
    )


async def _h_create_task(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("title", "")).strip()
    if not title:
        return {"ok": False, "error": "Falta el titulo de la tarea"}, []
    course = await _resolve_course(db, user, args.get("course_name"))
    due_at = _parse_datetime(args.get("due_at"))
    est = args.get("estimated_minutes")
    try:
        est_minutes = int(est) if est is not None else 60
    except (TypeError, ValueError):
        est_minutes = 60
    est_minutes = max(5, min(est_minutes, 60 * 40))
    priority = None
    if args.get("priority"):
        try:
            priority = TaskPriority(str(args["priority"]))
        except ValueError:
            priority = None
    task = Task(
        user_id=user.id,
        course_id=course.id if course else None,
        source=SourcePlatform.manual,
        external_id=f"manual-{uuid.uuid4()}",
        title=title[:500],
        description=args.get("description") or None,
        due_at=due_at,
        estimated_minutes=est_minutes,
        priority=priority or _guess_priority(due_at),
        status=TaskStatus.pending,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return (
        {"ok": True, "created": task.title, "id": str(task.id), "due_at": task.due_at.isoformat() if task.due_at else None},
        ["tasks", "courses"],
    )


async def _h_update_task(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("task_title", "")).strip()
    task, matches = await _find_task(db, user, title)
    if task is None:
        if matches:
            return {"ok": False, "error": "Varias tareas coinciden; se mas especifico", "matches": [t.title for t in matches]}, []
        return {"ok": False, "error": f"No encontre la tarea '{title}'"}, []
    if args.get("title"):
        task.title = str(args["title"])[:500]
    if args.get("description") is not None:
        task.description = args.get("description")
    if args.get("due_at") is not None:
        task.due_at = _parse_datetime(args.get("due_at"))
    if args.get("estimated_minutes") is not None:
        try:
            task.estimated_minutes = max(5, min(int(args["estimated_minutes"]), 60 * 40))
        except (TypeError, ValueError):
            pass
    if args.get("priority"):
        try:
            task.priority = TaskPriority(str(args["priority"]))
        except ValueError:
            pass
    if args.get("status"):
        try:
            task.status = TaskStatus(str(args["status"]))
        except ValueError:
            pass
    await db.commit()
    await db.refresh(task)
    return {"ok": True, "updated": task.title}, ["tasks"]


async def _h_complete_task(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("task_title", "")).strip()
    task, matches = await _find_task(db, user, title)
    if task is None:
        if matches:
            return {"ok": False, "error": "Varias tareas coinciden; se mas especifico", "matches": [t.title for t in matches]}, []
        return {"ok": False, "error": f"No encontre la tarea '{title}'"}, []
    task.status = TaskStatus.completed
    # Completa tambien las subtareas pendientes del planificador, si las hay.
    subtasks = await db.execute(
        select(Task).where(
            Task.parent_task_id == task.id,
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
    )
    for subtask in subtasks.scalars().all():
        subtask.status = TaskStatus.completed
    await db.commit()
    return {"ok": True, "completed": task.title}, ["tasks"]


async def _h_delete_task(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("task_title", "")).strip()
    task, matches = await _find_task(db, user, title)
    if task is None:
        if matches:
            return {"ok": False, "error": "Varias tareas coinciden; se mas especifico", "matches": [t.title for t in matches]}, []
        return {"ok": False, "error": f"No encontre la tarea '{title}'"}, []
    deleted = task.title
    await db.delete(task)
    await db.commit()
    return {"ok": True, "deleted": deleted}, ["tasks"]


async def _h_list_grades(db, user, args) -> tuple[dict, list[str]]:
    stmt = select(Grade).where(Grade.user_id == user.id)
    if args.get("course_name"):
        course = await _resolve_course(db, user, str(args["course_name"]), create_if_missing=False)
        if course is not None:
            stmt = stmt.where(Grade.course_id == course.id)
    result = await db.execute(stmt.order_by(Grade.graded_at.asc().nulls_last()))
    grades = list(result.scalars().all())
    course_ids = {g.course_id for g in grades if g.course_id}
    names: dict[uuid.UUID, str] = {}
    if course_ids:
        cres = await db.execute(select(Course).where(Course.id.in_(course_ids)))
        names = {c.id: c.name for c in cres.scalars().all()}
    return (
        {
            "ok": True,
            "grades": [
                {
                    "title": g.title,
                    "course": names.get(g.course_id) if g.course_id else None,
                    "score": g.score,
                    "max_score": g.max_score,
                    "percentage": g.percentage,
                    "weight": g.weight,
                    "graded_at": g.graded_at.isoformat() if g.graded_at else None,
                }
                for g in grades
            ],
        },
        [],
    )


async def _h_add_grade(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("title", "")).strip()
    if not title:
        return {"ok": False, "error": "Falta el titulo de la nota"}, []
    course = await _resolve_course(db, user, args.get("course_name"))
    try:
        max_score = float(args.get("max_score")) if args.get("max_score") is not None else 10.0
    except (TypeError, ValueError):
        max_score = 10.0
    score = args.get("score")
    if score is not None:
        try:
            score = float(score)
        except (TypeError, ValueError):
            score = None
    grade = Grade(
        user_id=user.id,
        course_id=course.id if course else None,
        title=title[:300],
        score=score,
        max_score=max_score,
        weight=float(args["weight"]) if args.get("weight") is not None else None,
        graded_at=_parse_date(args.get("graded_at")),
        notes=args.get("notes") or None,
    )
    db.add(grade)
    await db.commit()
    await db.refresh(grade)
    return {"ok": True, "created": grade.title, "id": str(grade.id)}, ["grades", "courses"]


async def _h_delete_grade(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("title", "")).strip()
    grade, matches = await _find_grade(db, user, title)
    if grade is None:
        if matches:
            return {"ok": False, "error": "Varias notas coinciden; se mas especifico", "matches": [g.title for g in matches]}, []
        return {"ok": False, "error": f"No encontre la nota '{title}'"}, []
    deleted = grade.title
    await db.delete(grade)
    await db.commit()
    return {"ok": True, "deleted": deleted}, ["grades"]


async def _h_list_timetable(db, user, args) -> tuple[dict, list[str]]:
    result = await db.execute(
        select(TimetableEntry).where(TimetableEntry.user_id == user.id).order_by(TimetableEntry.day_of_week)
    )
    entries = list(result.scalars().all())
    course_ids = {e.course_id for e in entries if e.course_id}
    names: dict[uuid.UUID, str] = {}
    if course_ids:
        cres = await db.execute(select(Course).where(Course.id.in_(course_ids)))
        names = {c.id: c.name for c in cres.scalars().all()}
    return (
        {
            "ok": True,
            "timetable": [
                {
                    "day_of_week": e.day_of_week,
                    "start": e.start_time.strftime("%H:%M"),
                    "end": e.end_time.strftime("%H:%M"),
                    "title": e.title,
                    "course": names.get(e.course_id) if e.course_id else None,
                    "location": e.location,
                }
                for e in entries
            ],
        },
        [],
    )


async def _h_add_timetable_entry(db, user, args) -> tuple[dict, list[str]]:
    day = _parse_day(args.get("day_of_week"))
    start = _parse_time(args.get("start_time"))
    end = _parse_time(args.get("end_time"))
    if day is None or start is None or end is None:
        return {"ok": False, "error": "Dia u horas invalidas (usa 0-6 y HH:MM)"}, []
    if start >= end:
        return {"ok": False, "error": "La hora de inicio debe ser anterior a la de fin"}, []
    course = await _resolve_course(db, user, args.get("course_name"))
    entry = TimetableEntry(
        user_id=user.id,
        course_id=course.id if course else None,
        title=(args.get("title") or None),
        day_of_week=day,
        start_time=start,
        end_time=end,
        location=(args.get("location") or None),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"ok": True, "created": f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}", "id": str(entry.id)}, ["timetable", "courses"]


async def _h_delete_timetable_entry(db, user, args) -> tuple[dict, list[str]]:
    title = str(args.get("title", "")).strip().lower()
    result = await db.execute(select(TimetableEntry).where(TimetableEntry.user_id == user.id))
    entries = list(result.scalars().all())
    matches = [e for e in entries if title in (e.title or "").lower()]
    if not matches and title.isdigit():
        matches = [e for e in entries if e.day_of_week == int(title)]
    if len(matches) != 1:
        return {"ok": False, "error": f"Coinciden {len(matches)} clases; se mas especifico"}, []
    await db.delete(matches[0])
    await db.commit()
    return {"ok": True, "deleted": "clase"}, ["timetable"]


async def _h_add_availability(db, user, args) -> tuple[dict, list[str]]:
    day = _parse_day(args.get("day_of_week"))
    start = _parse_time(args.get("start_time"))
    end = _parse_time(args.get("end_time"))
    if day is None or start is None or end is None:
        return {"ok": False, "error": "Dia u horas invalidas (usa 0-6 y HH:MM)"}, []
    if start >= end:
        return {"ok": False, "error": "La hora de inicio debe ser anterior a la de fin"}, []
    block = ScheduleBlock(
        user_id=user.id,
        day_of_week=day,
        start_time=start,
        end_time=end,
        label=(args.get("label") or None),
        is_active=True,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return {"ok": True, "created": f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}"}, ["schedule"]


async def _h_get_plan(db, user, args) -> tuple[dict, list[str]]:
    result = await db.execute(
        select(Task)
        .where(
            Task.user_id == user.id,
            Task.target_start_at.is_not(None),
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
        .order_by(Task.target_start_at.asc())
    )
    tasks = list(result.scalars().all())
    return (
        {
            "ok": True,
            "sessions": [
                {
                    "title": t.title,
                    "start_at": t.target_start_at.isoformat() if t.target_start_at else None,
                    "end_at": t.target_end_at.isoformat() if t.target_end_at else None,
                }
                for t in tasks
            ],
            "note": "El plan se recalcula al abrir el dashboard o pulsar Replanificar.",
        },
        [],
    )


_HANDLERS = {
    "list_courses": _h_list_courses,
    "create_course": _h_create_course,
    "delete_course": _h_delete_course,
    "list_tasks": _h_list_tasks,
    "create_task": _h_create_task,
    "update_task": _h_update_task,
    "complete_task": _h_complete_task,
    "delete_task": _h_delete_task,
    "list_grades": _h_list_grades,
    "add_grade": _h_add_grade,
    "delete_grade": _h_delete_grade,
    "list_timetable": _h_list_timetable,
    "add_timetable_entry": _h_add_timetable_entry,
    "delete_timetable_entry": _h_delete_timetable_entry,
    "add_availability": _h_add_availability,
    "get_plan": _h_get_plan,
}
