"""Recordatorios diarios por Telegram de tareas y examenes."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from app.core.crypto import decrypt
from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.reminder_settings import ReminderSettings
from app.models.shared_class import ClassEvent, ClassMembership
from app.models.task import Task
from app.models.enums import TaskStatus
from app.models.user import User

logger = get_logger(__name__)

_DAY_NAMES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


async def send_telegram(token: str, chat_id: str, text: str) -> None:
    """Envia un mensaje a Telegram. Lanza RuntimeError si falla."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text[:4000], "disable_web_page_preview": True}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, json=payload)
        try:
            data = response.json()
        except ValueError:
            data = {}
        if response.status_code >= 400 or not data.get("ok", False):
            detail = data.get("description") or f"HTTP {response.status_code}"
            raise RuntimeError(f"Telegram rechazo el mensaje: {detail}")


async def build_summary(db, user: User) -> str | None:
    """Resumen de tareas pendientes y examenes proximos (3 y 7 dias)."""
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=3)
    week = now + timedelta(days=7)

    tasks_result = await db.execute(
        select(Task)
        .where(
            Task.user_id == user.id,
            Task.parent_task_id.is_(None),
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
            Task.due_at.is_not(None),
            Task.due_at >= now - timedelta(hours=2),
            Task.due_at <= soon,
        )
        .order_by(Task.due_at.asc())
        .limit(8)
    )
    tasks = list(tasks_result.scalars().all())

    exams_result = await db.execute(
        select(ClassEvent)
        .join(ClassMembership, ClassMembership.class_id == ClassEvent.class_id)
        .where(
            ClassMembership.user_id == user.id,
            ClassEvent.is_exam.is_(True),
            ClassEvent.start_at >= now,
            ClassEvent.start_at <= week,
        )
        .order_by(ClassEvent.start_at.asc())
        .limit(8)
    )
    exams = list(exams_result.scalars().all())

    if not tasks and not exams:
        return None

    lines = [f"Hola {user.full_name or 'estudiante'}, esto es lo que viene:"]
    if tasks:
        lines.append("\nTareas proximas:")
        for task in tasks:
            when = task.due_at.astimezone(timezone.utc)
            lines.append(f"- {task.title} (vence {when:%d/%m %H:%M} UTC)")
    if exams:
        lines.append("\nExamenes de tus clases:")
        for exam in exams:
            when = exam.start_at.astimezone(timezone.utc)
            day = _DAY_NAMES[when.weekday()]
            lines.append(f"- {exam.title} ({day} {when:%d/%m %H:%M} UTC)")
    lines.append("\nEntra en Academic Autopilot para ver el plan completo.")
    return "\n".join(lines)


def reminder_read(settings_row: ReminderSettings | None) -> dict:
    if settings_row is None:
        return {
            "enabled": False,
            "reminder_hour": 19,
            "telegram_chat_id": None,
            "has_token": False,
        }
    return {
        "enabled": settings_row.enabled,
        "reminder_hour": settings_row.reminder_hour,
        "telegram_chat_id": settings_row.telegram_chat_id,
        "has_token": bool(settings_row.telegram_token_encrypted),
    }


async def send_pending_reminders() -> None:
    """Job horario: envia el resumen a quien le toque a esta hora (UTC)."""
    now = datetime.now(timezone.utc)
    sent = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ReminderSettings).where(ReminderSettings.enabled.is_(True))
        )
        rows = list(result.scalars().all())
        for row in rows:
            try:
                if row.reminder_hour != now.hour:
                    continue
                if row.last_sent_on == now.date():
                    continue
                if not row.telegram_chat_id or not row.telegram_token_encrypted:
                    continue
                user = await session.get(User, row.user_id)
                if user is None:
                    continue
                summary = await build_summary(session, user)
                if not summary:
                    continue
                token = decrypt(row.telegram_token_encrypted)
                if not token:
                    continue
                await send_telegram(token, row.telegram_chat_id, summary)
                row.last_sent_on = now.date()
                await session.commit()
                sent += 1
            except Exception as exc:  # noqa: BLE001 - un fallo no debe parar al resto
                await session.rollback()
                logger.warning("Recordatorio fallido para %s: %s", row.user_id, exc)
    if sent:
        logger.info("Recordatorios enviados: %d", sent)


async def send_test(user_id: uuid.UUID) -> None:
    """Envia un mensaje de prueba con la configuracion guardada."""
    async with AsyncSessionLocal() as session:
        row = await _get_settings(session, user_id)
        if row is None or not row.telegram_chat_id or not row.telegram_token_encrypted:
            raise RuntimeError("Guarda primero tu token y tu chat de Telegram.")
        token = decrypt(row.telegram_token_encrypted)
        if not token:
            raise RuntimeError("No se pudo descifrar el token guardado. Vuelve a escribirlo.")
        await send_telegram(
            token,
            row.telegram_chat_id,
            "Academic Autopilot: recordatorios conectados. Te avisare de tus tareas y examenes.",
        )


async def _get_settings(db, user_id: uuid.UUID) -> ReminderSettings | None:
    result = await db.execute(
        select(ReminderSettings).where(ReminderSettings.user_id == user_id)
    )
    return result.scalar_one_or_none()
