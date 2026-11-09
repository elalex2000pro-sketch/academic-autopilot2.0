"""Servicio de IA Studio (chat tutor y organizacion del estudio).

Se conecta a un modelo servido por una API compatible con la de OpenAI (Ollama,
LM Studio, OpenAI, Groq...). Si el modelo no esta disponible, cae a un motor de
recomendaciones heuristico para seguir siendo util sin conexion.
"""
from __future__ import annotations

import json
import re
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
from app.models.important_date import ImportantDate
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
    "IA Studio (chat tutor, transcripcion de audio, analisis de documentos, resumenes, "
    "infografias y mapas mentales), "
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
    "notas, clases del horario y disponibilidad. Para crear CUALQUIER evento del calendario "
    "(examen, tarea/entrega o fecha importante) usa SIEMPRE add_event_to_calendar, con la fecha "
    "en YYYY-MM-DD y el tipo exam, task o important_date. Interpreta fechas relativas usando la "
    "fecha actual del contexto y no pidas confirmacion para crear eventos. Para ELIMINAR algo nunca lo hagas directamente: "
    "invoca la herramienta de borrado y el sistema pedira confirmacion al usuario. Si falta un dato "
    "clave (fecha de entrega, nota, asignatura), preguntalo antes de actuar. Tras crear o cambiar "
    "algo, confirma en UNA frase con los datos clave.\n"
    "IMAGENES Y DOCUMENTOS ESCANEADOS: Analiza el contenido de estas imágenes o fragmentos de "
    "libro escaneado y responde a la duda del estudiante con precisión. Si es una foto de la "
    "pizarra, un examen o una lista de tareas, describe lo que ves y ofrece convertirlo en tareas "
    "o eventos de su calendario."
)

_VISUAL_PROMPT = (
    "Analiza el contenido de estas imágenes o fragmentos de libro escaneado y responde a la "
    "duda del estudiante con precisión."
)


@dataclass
class AiResult:
    """Resultado de un turno del asistente."""

    reply: str
    source: str
    pending_action: dict[str, Any] | None = None
    events: list[str] = field(default_factory=list)


# Proveedores remotos que exigen clave de API (local y custom pueden no tenerla).
_API_KEY_REQUIRED = {"gemini", "openai", "claude", "openrouter"}


@dataclass
class AiProfile:
    """Configuracion efectiva de IA para un usuario concreto (proveedor hibrido)."""

    provider: str  # local | gemini | openai | claude | openrouter | custom
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
        """Listo para llamar al modelo? (los remotos exigen clave; local no)."""
        if not self.base_url or not self.model:
            return False
        if self.provider in _API_KEY_REQUIRED and not self.api_key:
            return False
        return True


def resolve_profile(user: User) -> AiProfile:
    """Resuelve que modelo/endpoint usar segun el proveedor elegido por el usuario.

    Todos los proveedores se llaman con la API compatible con OpenAI:
    - "local": Ollama u otro servidor propio (AI_BASE_URL del .env).
    - "gemini": Google AI Studio (Gemini).
    - "openai": ChatGPT (api.openai.com).
    - "claude": Claude de Anthropic (capa compatible con OpenAI).
    - "openrouter": una clave con acceso a casi todos los modelos.
    - "custom": cualquier otro endpoint compatible indicado por el usuario.
    La clave de API se guarda cifrada por usuario en `users.ai_api_key_encrypted`.
    """
    provider = (user.ai_provider or settings.ai_default_provider or "local").lower()
    user_model = (user.ai_model or "").strip()
    user_base = (user.ai_base_url or "").strip().rstrip("/")
    api_key = crypto.decrypt(user.ai_api_key_encrypted) or ""

    if provider == "custom":
        return AiProfile(
            provider="custom",
            base_url=user_base,
            model=user_model,
            vision_model=user_model,
            api_key=api_key,
            temperature=settings.ai_temperature,
            timeout_seconds=settings.ai_timeout_seconds,
            tools_enabled=settings.ai_tools_enabled,
            max_tool_iterations=settings.ai_max_tool_iterations,
        )

    presets: dict[str, tuple[str, str, str]] = {
        "gemini": (
            settings.ai_gemini_base_url,
            settings.ai_gemini_model,
            settings.ai_gemini_vision_model,
        ),
        "openai": (
            settings.ai_openai_base_url,
            settings.ai_openai_model,
            settings.ai_openai_model,
        ),
        "claude": (
            settings.ai_claude_base_url,
            settings.ai_claude_model,
            settings.ai_claude_model,
        ),
        "openrouter": (
            settings.ai_openrouter_base_url,
            settings.ai_openrouter_model,
            settings.ai_openrouter_model,
        ),
    }

    if provider in presets:
        base_url, model, vision_model = presets[provider]
        if user_model:
            model = user_model
            vision_model = user_model
        return AiProfile(
            provider=provider,
            base_url=base_url,
            model=model,
            vision_model=vision_model,
            api_key=api_key,
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

    result = await db.execute(
        select(ImportantDate)
        .where(ImportantDate.user_id == user.id)
        .order_by(ImportantDate.date.asc())
    )
    important_dates = list(result.scalars().all())

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
        "exams": [
            {
                "title": g.title,
                "course": courses.get(g.course_id) if g.course_id else None,
                "date": g.graded_at.isoformat(),
            }
            for g in grades
            if g.is_exam and g.graded_at is not None
        ],
        "important_dates": [
            {"title": e.title, "date": e.date.isoformat(), "notes": e.notes}
            for e in important_dates
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

    if ctx.get("exams"):
        lines.append("\nEXAMENES PROGRAMADOS:")
        for exam in ctx["exams"]:
            lines.append(
                f"- {exam['title']} [{exam['course'] or 'sin asignatura'}] | {exam['date']}"
            )

    if ctx.get("important_dates"):
        lines.append("\nFECHAS IMPORTANTES:")
        for event in ctx["important_dates"]:
            lines.append(
                f"- {event['title']} | {event['date']}"
                + (f" ({event['notes']})" if event.get("notes") else "")
            )

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


def _append_page_context(
    system: str, page_context: str | None, label: str | None
) -> str:
    """Añade al prompt el texto del PDF abierto sin guardarlo en el historial."""
    text = (page_context or "").strip()
    if not text:
        return system
    name = (label or "PDF abierto en la Biblioteca").strip()
    return (
        f"{system}\n\nTEXTO DEL PDF ABIERTO ({name}):\n"
        f"{text[: settings.ai_studio_max_chars]}\n\n"
        "Este texto es la pagina o el capitulo que el estudiante esta leyendo en la "
        "Biblioteca. Usalo como fuente principal si pide un resumen, un mapa mental, "
        "un esquema o pregunta por el contenido. Responde con naturalidad y no "
        "menciones que el texto se adjunto automaticamente."
    )


async def generate_reply(
    db: AsyncSession,
    user: User,
    message: str,
    history: list[dict[str, str]],
    image_data_urls: list[str] | None = None,
    document_text: str | None = None,
    document_name: str | None = None,
    page_context: str | None = None,
    page_context_label: str | None = None,
) -> AiResult:
    """Responde al usuario. Usa el modelo (con herramientas y vision) si esta
    disponible; si no, cae al motor heuristico.

    `document_text` permite chatear con apuntes y examenes en PDF, Word, Excel o
    texto. `page_context` recibe el texto extraido del PDF abierto en la
    Biblioteca y se inyecta solo en el prompt (nunca en el historial visible).
    Las fotos y las paginas de PDF escaneado se envian como imagenes (data URL)
    al modelo de vision.

    Devuelve un AiResult con el texto, la fuente, una posible accion pendiente de
    confirmacion (borrados) y los eventos de tiempo real generados.
    """
    ctx = await build_context(db, user)
    system = f"{_SYSTEM_PROMPT}\n\nCONTEXTO DEL ESTUDIANTE:\n{render_context_text(ctx)}"
    system = _append_page_context(system, page_context, page_context_label)

    if document_text:
        label = document_name or "documento adjunto"
        system = (
            f"{system}\n\nDOCUMENTO ADJUNTO ({label}):\n"
            f"{document_text[: settings.ai_studio_max_chars]}\n\n"
            "Usa el contenido del documento como fuente principal para responder. "
            "Si la pregunta no se puede responder con el documento, dilo y ofrece lo que si aparece."
        )

    images = [url for url in (image_data_urls or []) if url]
    prompt = message.strip()
    if not prompt and images:
        prompt = _VISUAL_PROMPT
    if not prompt and document_text:
        prompt = "Analiza el documento adjunto y dime lo mas importante."
    if not prompt and page_context:
        prompt = "Resume el texto del PDF que estoy leyendo."

    profile = resolve_profile(user)
    if profile.configured:
        try:
            if profile.provider == "gemini" and images:
                # Gemini recibe las imagenes con `inlineData` en su API nativa.
                try:
                    result = await _run_model_gemini(
                        db, user, profile, system, history, prompt, images
                    )
                except Exception as exc:  # noqa: BLE001 - se intenta la ruta OpenAI
                    logger.warning(
                        "Gemini nativo no disponible (%s); probando la API compatible con OpenAI",
                        exc,
                    )
                    result = await _run_model(
                        db, user, profile, system, history, prompt, images
                    )
            else:
                result = await _run_model(
                    db, user, profile, system, history, prompt, images
                )
            if result.reply:
                return result
            logger.warning("El modelo devolvio una respuesta vacia; usando heuristico")
        except Exception as exc:  # noqa: BLE001 - degradacion controlada
            logger.warning(
                "IA Studio (%s) no disponible (%s); usando heuristico",
                profile.provider,
                exc,
            )

    if document_text:
        return AiResult(
            heuristic_document_reply(document_name, document_text, message), "heuristic"
        )
    if page_context:
        return AiResult(
            heuristic_document_reply(
                page_context_label, page_context, message or "resumen"
            ),
            "heuristic",
        )
    if images:
        return AiResult(
            "He recibido tus imágenes, pero el modelo de visión no está disponible ahora mismo. "
            "Revisa el motor de IA en Ajustes o inténtalo de nuevo en unos minutos.",
            "heuristic",
        )
    return AiResult(heuristic_reply(ctx, message), "heuristic")


def _user_message(message: str, image_data_urls: list[str]) -> dict[str, Any]:
    if not image_data_urls:
        return {"role": "user", "content": message}
    content: list[dict[str, Any]] = [
        {"type": "text", "text": message or _VISUAL_PROMPT}
    ]
    content.extend(
        {"type": "image_url", "image_url": {"url": url}} for url in image_data_urls
    )
    return {"role": "user", "content": content}


async def _run_model(
    db: AsyncSession,
    user: User,
    profile: AiProfile,
    system: str,
    history: list[dict[str, str]],
    message: str,
    image_data_urls: list[str],
) -> AiResult:
    """Bucle de tool-calling por la API compatible con OpenAI.

    Con imagenes usa el modelo de vision y las envia como `image_url`.
    """
    model = profile.vision_model if image_data_urls else profile.model
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        *history,
        _user_message(message, image_data_urls),
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


# --------------------------------------------------------------------------- #
# Gemini nativo (inlineData)
# --------------------------------------------------------------------------- #
_GEMINI_TYPES = {
    "object": "OBJECT",
    "string": "STRING",
    "integer": "INTEGER",
    "number": "NUMBER",
    "boolean": "BOOLEAN",
    "array": "ARRAY",
    "null": "NULL",
}


def _gemini_native_url(profile: AiProfile, model: str) -> str:
    """Convierte la base compatible con OpenAI en el endpoint nativo de Gemini."""
    base = profile.base_url.rstrip("/")
    if base.endswith("/openai"):
        base = base[: -len("/openai")]
    return f"{base}/models/{model}:generateContent"


def _split_data_url(data_url: str) -> tuple[str, str]:
    header, separator, data = data_url.partition(",")
    if not separator or not header.startswith("data:") or ";base64" not in header:
        raise ValueError("La imagen adjunta no tiene un formato valido")
    mime_type = header[len("data:") :].split(";", 1)[0] or "image/jpeg"
    return mime_type, data


def _append_gemini_parts(
    contents: list[dict[str, Any]], role: str, parts: list[dict[str, Any]]
) -> None:
    """Agrupa turnos consecutivos del mismo rol (Gemini espera user/model)."""
    if contents and contents[-1].get("role") == role:
        contents[-1].setdefault("parts", []).extend(parts)
    else:
        contents.append({"role": role, "parts": parts})


def _gemini_contents(
    history: list[dict[str, str]], message: str, image_data_urls: list[str]
) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for item in history:
        text = (item.get("content") or "").strip()
        if not text:
            continue
        role = "model" if item.get("role") == "assistant" else "user"
        _append_gemini_parts(contents, role, [{"text": text}])

    parts: list[dict[str, Any]] = [{"text": message or _VISUAL_PROMPT}]
    for data_url in image_data_urls:
        mime_type, data = _split_data_url(data_url)
        parts.append({"inlineData": {"mimeType": mime_type, "data": data}})
    _append_gemini_parts(contents, "user", parts)
    return contents


def _gemini_schema(schema: Any) -> dict[str, Any]:
    """Adapta el JSON Schema de OpenAI al subconjunto que acepta Gemini."""
    if not isinstance(schema, dict):
        return {"type": "STRING"}
    result: dict[str, Any] = {}
    for key, value in schema.items():
        if key == "type" and isinstance(value, str):
            result[key] = _GEMINI_TYPES.get(value.lower(), value.upper())
        elif key == "properties" and isinstance(value, dict):
            result[key] = {name: _gemini_schema(item) for name, item in value.items()}
        elif key == "items":
            result[key] = _gemini_schema(value)
        elif key in {"description", "required", "enum", "format", "nullable"}:
            result[key] = value
    if "type" not in result and result.get("properties"):
        result["type"] = "OBJECT"
    return result


def _gemini_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    declarations: list[dict[str, Any]] = []
    for tool in tools:
        function = tool.get("function") or {}
        name = function.get("name")
        if not name:
            continue
        declaration: dict[str, Any] = {
            "name": name,
            "description": function.get("description") or "",
        }
        parameters = function.get("parameters")
        if isinstance(parameters, dict) and parameters.get("properties"):
            declaration["parameters"] = _gemini_schema(parameters)
        declarations.append(declaration)
    return [{"functionDeclarations": declarations}] if declarations else []


async def _run_model_gemini(
    db: AsyncSession,
    user: User,
    profile: AiProfile,
    system: str,
    history: list[dict[str, str]],
    message: str,
    image_data_urls: list[str],
) -> AiResult:
    """Bucle de tool-calling con la API nativa de Gemini e `inlineData`."""
    model = profile.vision_model if image_data_urls else profile.model
    contents = _gemini_contents(history, message, image_data_urls)
    tools = _gemini_tools(ai_tools.tool_schemas()) if profile.tools_enabled else None
    events: list[str] = []
    last_text = ""

    for _ in range(max(1, profile.max_tool_iterations)):
        content = await _post_gemini(profile, model, system, contents, tools)
        parts = [
            part for part in (content.get("parts") or []) if isinstance(part, dict)
        ]
        last_text = "".join(
            str(part.get("text") or "")
            for part in parts
            if part.get("text") and not part.get("thought")
        ).strip()
        calls = [
            part["functionCall"]
            for part in parts
            if isinstance(part.get("functionCall"), dict)
        ]
        if not calls:
            return AiResult(last_text, "ai", events=events)

        # Se devuelve el turno del modelo tal cual (incluye thoughtSignature en
        # Gemini 2.5), y despues las respuestas de las herramientas.
        contents.append({"role": "model", "parts": parts})
        responses: list[dict[str, Any]] = []
        for call in calls:
            name = str(call.get("name") or "")
            args = call.get("args") if isinstance(call.get("args"), dict) else {}
            if name in ai_tools.DESTRUCTIVE:
                note = (
                    last_text
                    or "Voy a realizar una accion destructiva. Confirma si quieres que continue."
                )
                return AiResult(
                    note,
                    "ai",
                    pending_action={"tool": name, "args": args},
                    events=events,
                )
            payload, ev = await ai_tools.execute_tool(db, user, name, args)
            events.extend(ev)
            responses.append(
                {
                    "functionResponse": {
                        "name": name,
                        "response": {"result": payload},
                    }
                }
            )
        contents.append({"role": "user", "parts": responses})

    return AiResult(
        last_text or "He realizado las acciones solicitadas. Revisa tus secciones para ver los cambios.",
        "ai",
        events=events,
    )


async def _post_gemini(
    profile: AiProfile,
    model: str,
    system: str,
    contents: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Llama a models/{model}:generateContent y devuelve el contenido del modelo."""
    url = _gemini_native_url(profile, model)
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": profile.api_key,
    }

    async def _send(include_tools: bool) -> httpx.Response:
        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {"temperature": profile.temperature},
        }
        if include_tools and tools:
            payload["tools"] = tools
            payload["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}
        async with httpx.AsyncClient(timeout=profile.timeout_seconds) as client:
            return await client.post(url, json=payload, headers=headers)

    response = await _send(bool(tools))
    if response.status_code == 400 and tools:
        logger.info("Gemini no acepta herramientas; reintentando sin ellas")
        response = await _send(False)
    if response.is_error:
        logger.warning(
            "Gemini devolvio %s: %s", response.status_code, response.text[:500]
        )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return {}
    return candidates[0].get("content", {}) or {}


_QUESTION_STOPWORDS = {
    "para",
    "como",
    "cual",
    "cuales",
    "que",
    "con",
    "por",
    "del",
    "las",
    "los",
    "una",
    "uno",
    "unos",
    "unas",
    "este",
    "esta",
    "esto",
    "estos",
    "estas",
    "sobre",
    "tengo",
    "quiero",
    "puedes",
    "puede",
    "hola",
    "gracias",
    "favor",
    "ayuda",
    "ayudame",
    "dime",
    "explica",
    "responde",
    "resolver",
    "hacer",
    "hago",
    "hoy",
    "semana",
}

_PLANNING_MARKERS = (
    "tarea",
    "tareas",
    "plan",
    "planifica",
    "planificar",
    "estudiar",
    "estudio",
    "prioridad",
    "prioriza",
    "examen",
    "examenes",
    "exámenes",
    "horario",
    "tiempo",
    "hoy",
    "semana",
    "organiza",
    "organizar",
    "entrega",
    "entregar",
)


def _question_excerpt(message: str, limit: int = 180) -> str:
    """Normaliza la pregunta para citarla en el fallback sin cortar palabras raras."""
    clean = " ".join((message or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rstrip() + "…"


def _question_terms(message: str) -> list[str]:
    """Palabras utiles para buscar una respuesta extractiva en un documento."""
    terms: list[str] = []
    for raw in re.findall(r"[a-záéíóúüñ]{4,}", (message or "").lower()):
        if raw in _QUESTION_STOPWORDS or raw in terms:
            continue
        terms.append(raw)
        if len(terms) >= 6:
            break
    return terms


def heuristic_document_reply(
    document_name: str | None, text: str, question: str = ""
) -> str:
    """Respuesta extractiva de emergencia cuando no hay motor de IA configurado.

    No intenta fingir una respuesta del modelo: busca lineas relacionadas con la
    pregunta para que el modo sin conexion siga siendo util y no repita siempre
    el mismo resumen inicial.
    """
    question = _question_excerpt(question)
    source_lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if line:
            source_lines.append(line[:240])
        if len(source_lines) >= 80:
            break

    selected = source_lines[:6]
    matched = False
    terms = _question_terms(question)
    if terms:
        related: list[str] = []
        for line in source_lines:
            if any(term in line.lower() for term in terms):
                related.append(line)
            if len(related) >= 6:
                break
        if related:
            selected = related
            matched = True

    preview = "\n".join(f"- {line}" for line in selected) or "- (sin texto legible)"
    label = document_name or "el documento"
    if question:
        if matched:
            heading = f"Para «{question}», esto es lo que encuentro en «{label}»:"
        else:
            heading = (
                f"He leido «{label}», pero no encuentro una coincidencia literal con "
                f"«{question}». Esto es lo mas destacado:"
            )
    else:
        heading = f"He leido «{label}». Esto es lo mas destacado que encuentro:"

    return (
        f"{heading}\n{preview}\n\n"
        "Para responder preguntas concretas sobre el documento, configura un motor de IA "
        "en Ajustes. Mientras tanto, puedo darte este resumen por reglas."
    )


def heuristic_reply(ctx: dict[str, Any], message: str) -> str:
    """Recomendaciones por reglas cuando el modelo no esta disponible.

    El mensaje del usuario se usa para elegir el tipo de ayuda y para no devolver
    siempre el mismo plan. Es un fallback honesto: si la pregunta no es de
    organizacion, lo dice en vez de inventar una respuesta.
    """
    question = _question_excerpt(message)
    lower = question.lower()
    tasks = ctx["tasks"]

    if any(token in lower for token in ("hola", "buenas", "hey")):
        return (
            "Hola. Puedo ayudarte a organizar tus tareas y a decidir por donde empezar. "
            "Para respuestas abiertas, conecta un motor de IA en Ajustes."
        )
    if "gracias" in lower:
        return "De nada. Cuando quieras, revisamos tu plan de estudio o tus proximas entregas."

    is_document_question = any(
        token in lower for token in ("documento", "apunte", "apuntes", "resumen", "pdf")
    )
    if is_document_question:
        return (
            f"Para «{question}» necesito el contenido del documento. Abre el modo Documento "
            "de IA Studio, selecciona o sube el archivo y preguntame alli. Sin un motor de IA "
            "conectado solo puedo hacer una busqueda extractiva, no una respuesta razonada."
        )

    wants_plan = any(token in lower for token in _PLANNING_MARKERS)
    if not wants_plan:
        return (
            f"No tengo un motor de IA conectado para responder a «{question}» con precision. "
            "Puedo ayudarte con la organizacion de tu estudio: dime una tarea, un examen o una "
            "fecha y te propongo por donde empezar. Para respuestas abiertas, configura Gemini "
            "u otro motor en Ajustes."
        )

    if not tasks:
        if "examen" in lower or "examenes" in lower or "exámenes" in lower:
            return (
                f"Para preparar un examen («{question}») divide el temario en bloques de 30-45 "
                "minutos y deja el ultimo dia para repasar. Ahora mismo no tienes tareas "
                "pendientes; anade el examen o sus temas como tareas para poder repartirlos."
            )
        return (
            f"Para «{question}», ahora mismo no tienes tareas pendientes. Anade asignaturas y "
            "tareas con fecha de entrega y una estimacion de tiempo; en cuanto las tengas, "
            "te dire por donde empezar y que dias dedicar a cada cosa."
        )

    now = ctx["now"]
    if "examen" in lower or "examenes" in lower or "exámenes" in lower:
        lines = [
            f"Para «{question}», prepara el examen en bloques y repasa lo mas urgente primero:"
        ]
    elif "hoy" in lower:
        lines = [f"Para hoy, esto es lo que priorizaria segun «{question}»:"]
    elif "semana" in lower:
        lines = [f"Para organizar la semana segun «{question}», este es el orden:"]
    elif "prioridad" in lower or "prioriza" in lower:
        lines = [f"Para decidir prioridades («{question}»), empieza por lo mas urgente:"]
    else:
        lines = [f"Para «{question}», este es el plan que puedo darte con tus datos:"]

    for t in tasks[:5]:
        course = t["course"] or "Sin asignatura"
        when = _urgency_label(t["due_at"], now)
        est = t["estimated_minutes"]
        lines.append(f"- {t['title']} ({course}): empieza {when}. Bloque de ~{est} min.")

    if len(tasks) > 5:
        lines.append(f"- y {len(tasks) - 5} tarea(s) mas, siguiendo el mismo orden de entrega.")

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
        "\nNota: te respondo con el motor de reglas porque IA Studio no "
        "esta disponible ahora mismo (revisa Ajustes, seccion Motor de IA Studio)."
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
