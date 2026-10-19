"""Servicio del asistente de IA (organizacion del estudio).

Se conecta a un modelo servido por una API compatible con la de OpenAI (Ollama,
LM Studio, OpenAI, Groq...). Si el modelo no esta disponible, cae a un motor de
recomendaciones heuristico para seguir siendo util sin conexion.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import crypto
from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.course import Course
from app.models.enums import TaskStatus
from app.models.grade import Grade
from app.models.schedule_block import ScheduleBlock
from app.models.task import Task
from app.models.timetable_entry import TimetableEntry
from app.models.user import User
from app.services import ai_tools

logger = get_logger(__name__)

_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]


_APP_KNOWLEDGE = (
    "CONOCES LA APLICACION 'Academic Autopilot' (gestion academica personal). "
    "Sus secciones son: Panel (resumen y plan del dia), Asignaturas (cursos y sus notas), "
    "Horario (clases semanales), Calendario (vista mensual de entregas y tareas), Examenes, "
    "IA Studio (resumenes e infografias a partir de apuntes), Asistente (este chat), "
    "Clases compartidas (grupos con un codigo permanente, chat, calendario en comun y "
    "archivos compartidos hasta 20 GB), "
    "Archivos (apuntes por asignatura), Enfoque/Focus (temporizador de estudio) y Ajustes "
    "(disponibilidad semanal y cuenta). Explica estas secciones si te preguntan."
)

_SYSTEM_PROMPT = (
    "Eres el asistente academico de 'Academic Autopilot', especializado en "
    "organizacion del estudio y gestion de tareas. Ayudas al estudiante a decidir "
    "CUANDO empezar a estudiar, como repartir el tiempo, priorizar y planificar su semana. "
    "Responde SIEMPRE en espanol, breve y accionable (pocas frases o una lista corta de pasos). "
    "No inventes datos: usa solo el CONTEXTO del estudiante. Cuando recomiendes horarios, "
    "basa las horas en su disponibilidad y en la fecha de hoy. Si falta informacion, pide "
    "solo lo imprescindible en una frase.\n\n"
    f"{_APP_KNOWLEDGE}\n\n"
    "PUEDES OPERAR LA APP: mediante herramientas creas, editas y completas asignaturas, tareas, "
    "notas, clases del horario y disponibilidad. Para ELIMINAR algo nunca lo hagas directamente: "
    "invoca la herramienta de borrado y el sistema pedira confirmacion al usuario. Si falta un dato "
    "clave (fecha de entrega, nota, asignatura), preguntalo antes de actuar. Tras crear o cambiar "
    "algo, confirma en UNA frase con los datos clave.\n"
    "IMAGENES: si el usuario adjunta una foto (pizarra, examen, lista de tareas...), describe lo que "
    "ves y ofrece convertirlo en tareas o eventos de su calendario."
)


@dataclass
class AiResult:
    """Resultado de un turno del asistente."""

    reply: str
    source: str
    pending_action: dict[str, Any] | None = None
    events: list[str] = field(default_factory=list)


@dataclass
class AiProfile:
    """Configuracion efectiva de IA para un usuario concreto (proveedor hibrido)."""

    provider: str  # local | gemini
    base_url: str
    model: str
    vision_model: str
    api_key: str
    temperature: float
    timeout_seconds: int
    tools_enabled: bool
    max_tool_iterations: int

    @property
    def configured(self) -> bool:
        """Listo para llamar al modelo? (Gemini exige clave; local solo base+modelo)."""
        if not self.base_url or not self.model:
            return False
        if self.provider == "gemini" and not self.api_key:
            return False
        return True


def resolve_profile(user: User) -> AiProfile:
    """Resuelve que modelo/endpoint usar segun el proveedor elegido por el usuario.

    - "local": Ollama (u otra API compatible con OpenAI) definida en el .env.
    - "gemini": endpoint compatible de Google AI Studio. La clave se guarda
      cifrada por usuario en `users.ai_api_key_encrypted`.
    """
    provider = (user.ai_provider or settings.ai_default_provider or "local").lower()

    if provider == "gemini":
        return AiProfile(
            provider="gemini",
            base_url=settings.ai_gemini_base_url,
            model=settings.ai_gemini_model,
            vision_model=settings.ai_gemini_vision_model,
            api_key=crypto.decrypt(user.ai_api_key_encrypted) or "",
            temperature=settings.ai_temperature,
            timeout_seconds=settings.ai_timeout_seconds,
            tools_enabled=settings.ai_tools_enabled,
            max_tool_iterations=settings.ai_max_tool_iterations,
        )

    return AiProfile(
        provider="local",
        base_url=settings.ai_base_url,
        model=settings.ai_model,
        vision_model=settings.ai_vision_model,
        api_key=settings.ai_api_key,
        temperature=settings.ai_temperature,
        timeout_seconds=settings.ai_timeout_seconds,
        tools_enabled=settings.ai_tools_enabled,
        max_tool_iterations=settings.ai_max_tool_iterations,
    )



async def build_context(db: AsyncSession, user: User) -> dict[str, Any]:
    """Reune tareas, asignaturas, disponibilidad, horario y notas del estudiante."""
    now = utcnow()

    result = await db.execute(
        select(Task)
        .where(
            Task.user_id == user.id,
            Task.parent_task_id.is_(None),
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
        .order_by(Task.due_at.asc().nulls_last())
    )
    tasks = list(result.scalars().all())

    result = await db.execute(
        select(Course.id, Course.name).where(Course.user_id == user.id)
    )
    courses = {row.id: row.name for row in result.all()}

    result = await db.execute(
        select(ScheduleBlock).where(
            ScheduleBlock.user_id == user.id, ScheduleBlock.is_active.is_(True)
        )
    )
    blocks = list(result.scalars().all())

    result = await db.execute(
        select(TimetableEntry).where(TimetableEntry.user_id == user.id)
    )
    timetable = list(result.scalars().all())

    result = await db.execute(
        select(Grade).where(Grade.user_id == user.id)
    )
    grades = list(result.scalars().all())

    grade_by_course: dict[uuid.UUID | None, list[float]] = {}
    for grade in grades:
        if grade.percentage is not None:
            grade_by_course.setdefault(grade.course_id, []).append(grade.percentage)

    return {
        "now": now,
        "timezone": user.timezone or "UTC",
        "courses": list(courses.values()),
        "course_names": courses,
        "tasks": [
            {
                "title": t.title,
                "course": courses.get(t.course_id) if t.course_id else None,
                "due_at": t.due_at,
                "estimated_minutes": t.estimated_minutes,
                "priority": t.priority.value,
                "status": t.status.value,
            }
            for t in tasks
        ],
        "availability": [
            {
                "day_of_week": b.day_of_week,
                "start": b.start_time,
                "end": b.end_time,
                "label": b.label,
            }
            for b in blocks
        ],
        "timetable": [
            {
                "day_of_week": e.day_of_week,
                "start": e.start_time,
                "end": e.end_time,
                "course": (courses.get(e.course_id) if e.course_id else None) or e.title,
                "location": e.location,
            }
            for e in timetable
        ],
        "grades": [
            {
                "course": courses.get(course_id) if course_id else None,
                "average_percent": round(sum(values) / len(values), 2),
                "count": len(values),
            }
            for course_id, values in grade_by_course.items()
        ],
    }


def render_context_text(ctx: dict[str, Any]) -> str:
    """Convierte el contexto en texto legible para el prompt del modelo."""
    lines: list[str] = []
    now = ctx["now"]
    lines.append(
        f"Fecha y hora actual (UTC): {now.strftime('%Y-%m-%d %H:%M')}. "
        f"Zona horaria del estudiante: {ctx['timezone']}."
    )

    lines.append("\nASIGNATURAS: " + (", ".join(ctx["courses"]) or "(ninguna)"))

    if ctx["tasks"]:
        lines.append("\nTAREAS PENDIENTES (por fecha de entrega):")
        for t in ctx["tasks"]:
            due = t["due_at"].strftime("%Y-%m-%d %H:%M") if t["due_at"] else "sin fecha"
            course = t["course"] or "sin asignatura"
            lines.append(
                f"- {t['title']} [{course}] | entrega: {due} | "
                f"~{t['estimated_minutes']} min | prioridad: {t['priority']}"
            )
    else:
        lines.append("\nTAREAS PENDIENTES: (ninguna)")

    if ctx["availability"]:
        lines.append("\nDISPONIBILIDAD SEMANAL PARA ESTUDIAR:")
        for b in ctx["availability"]:
            lines.append(
                f"- {_DAYS[b['day_of_week']]} {b['start']:%H:%M}-{b['end']:%H:%M}"
                + (f" ({b['label']})" if b["label"] else "")
            )
    else:
        lines.append("\nDISPONIBILIDAD: (no definida)")

    if ctx["timetable"]:
        lines.append("\nHORARIO DE CLASES:")
        for e in ctx["timetable"]:
            lines.append(
                f"- {_DAYS[e['day_of_week']]} {e['start']:%H:%M}-{e['end']:%H:%M} "
                f"{e['course'] or 'Clase'}"
                + (f" en {e['location']}" if e["location"] else "")
            )

    if ctx["grades"]:
        lines.append("\nNOTAS (media por asignatura):")
        for g in ctx["grades"]:
            lines.append(f"- {g['course'] or 'Sin asignatura'}: {g['average_percent']}% ({g['count']})")

    return "\n".join(lines)


async def generate_reply(
    db: AsyncSession,
    user: User,
    message: str,
    history: list[dict[str, str]],
    image_data_url: str | None = None,
) -> AiResult:
    """Responde al usuario. Usa el modelo (con herramientas y vision) si esta
    disponible; si no, cae al motor heuristico.

    Devuelve un AiResult con el texto, la fuente, una posible accion pendiente de
    confirmacion (borrados) y los eventos de tiempo real generados.
    """
    ctx = await build_context(db, user)
    system = f"{_SYSTEM_PROMPT}\n\nCONTEXTO DEL ESTUDIANTE:\n{render_context_text(ctx)}"

    profile = resolve_profile(user)
    if profile.configured:
        try:
            result = await _run_model(
                db, user, profile, system, history, message, image_data_url
            )
            if result.reply:
                return result
            logger.warning("El modelo devolvio una respuesta vacia; usando heuristico")
        except Exception as exc:  # noqa: BLE001 - degradacion controlada
            logger.warning(
                "Asistente IA (%s) no disponible (%s); usando heuristico",
                profile.provider,
                exc,
            )

    return AiResult(heuristic_reply(ctx, message), "heuristic")


def _user_message(message: str, image_data_url: str | None) -> dict[str, Any]:
    if not image_data_url:
        return {"role": "user", "content": message}
    return {
        "role": "user",
        "content": [
            {"type": "text", "text": message or "Analiza esta imagen."},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ],
    }


async def _run_model(
    db: AsyncSession,
    user: User,
    profile: AiProfile,
    system: str,
    history: list[dict[str, str]],
    message: str,
    image_data_url: str | None,
) -> AiResult:
    """Bucle de tool-calling. Con imagen usa el modelo de vision."""
    model = profile.vision_model if image_data_url else profile.model
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        *history,
        _user_message(message, image_data_url),
    ]
    tools = ai_tools.tool_schemas() if profile.tools_enabled else None
    events: list[str] = []
    last_text = ""

    for _ in range(max(1, profile.max_tool_iterations)):
        msg = await _post_chat(profile, messages, model, tools)
        last_text = (msg.get("content") or "").strip()
        tool_calls = msg.get("tool_calls") or []
        if not tool_calls:
            return AiResult(last_text, "ai", events=events)

        messages.append(
            {"role": "assistant", "content": msg.get("content") or "", "tool_calls": tool_calls}
        )
        for call in tool_calls:
            fn = call.get("function") or {}
            name = fn.get("name") or ""
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            if name in ai_tools.DESTRUCTIVE:
                note = last_text or "Voy a realizar una accion destructiva. Confirma si quieres que continue."
                return AiResult(
                    note,
                    "ai",
                    pending_action={"tool": name, "args": args},
                    events=events,
                )
            payload, ev = await ai_tools.execute_tool(db, user, name, args)
            events.extend(ev)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.get("id"),
                    "content": json.dumps(payload, ensure_ascii=False),
                }
            )

    return AiResult(
        last_text or "He realizado las acciones solicitadas. Revisa tus secciones para ver los cambios.",
        "ai",
        events=events,
    )


async def _post_chat(
    profile: AiProfile,
    messages: list[dict[str, Any]],
    model: str,
    tools: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Llama a /chat/completions y devuelve el mensaje del asistente.

    Si el modelo no soporta herramientas (error 400), reintenta sin ellas.
    """
    url = profile.base_url.rstrip("/") + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if profile.api_key:
        headers["Authorization"] = f"Bearer {profile.api_key}"

    async def _send(include_tools: bool) -> httpx.Response:
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": profile.temperature,
            "stream": False,
        }
        if include_tools and tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        async with httpx.AsyncClient(timeout=profile.timeout_seconds) as client:
            return await client.post(url, json=payload, headers=headers)

    response = await _send(bool(tools))
    if response.status_code == 400 and tools:
        logger.info("El modelo no acepta herramientas; reintentando sin ellas")
        response = await _send(False)
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        return {}
    return choices[0].get("message", {}) or {}


def heuristic_reply(ctx: dict[str, Any], message: str) -> str:
    """Recomendaciones por reglas: cuando empezar y que priorizar."""
    tasks = ctx["tasks"]
    if not tasks:
        return (
            "Ahora mismo no tienes tareas pendientes. Para poder ayudarte a organizarte, "
            "anade asignaturas y tareas (con su fecha de entrega y una estimacion de tiempo). "
            "En cuanto las tengas, te dire por donde empezar y que dias dedicar a cada cosa."
        )

    now = ctx["now"]
    lines = ["Este es mi plan recomendado basandome en tus tareas y disponibilidad:\n"]

    for t in tasks[:5]:
        course = t["course"] or "Sin asignatura"
        when = _urgency_label(t["due_at"], now)
        est = t["estimated_minutes"]
        lines.append(f"- {t['title']} ({course}): empieza {when}. Bloque de ~{est} min.")

    if len(tasks) > 5:
        lines.append(f"- y {len(tasks) - 5} tarea(s) mas, siguendo el mismo orden de entrega.")

    if ctx["availability"]:
        slots = ", ".join(
            f"{_DAYS[b['day_of_week']]} {b['start']:%H:%M}-{b['end']:%H:%M}"
            for b in ctx["availability"][:3]
        )
        lines.append(f"\nUsa tus franjas disponibles ({slots}) y trabaja primero lo mas urgente.")
    else:
        lines.append(
            "\nNo has definido disponibilidad; marcala en Ajustes para que pueda repartir tu tiempo."
        )

    lines.append(
        "\nNota: te respondo con el motor de reglas porque el asistente de IA no "
        "esta disponible ahora mismo (revisa Ajustes, seccion Motor del asistente IA)."
    )
    return "\n".join(lines)


def _urgency_label(due_at: datetime | None, now: datetime) -> str:
    if due_at is None:
        return "cuando antes tengas un hueco"
    hours = (due_at - now).total_seconds() / 3600
    if hours <= 0:
        return "ya, la entrega esta vencida o es inminente"
    if hours <= 72:
        return "hoy mismo"
    if hours <= 24 * 7:
        return "en los proximos 2 dias"
    return "esta semana sin agobios"
