"""Ajustes de recordatorios por Telegram."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.crypto import encrypt
from app.core.logging import get_logger
from app.models.reminder_settings import ReminderSettings
from app.schemas.reminders import ReminderRead, ReminderTestResult, ReminderUpdate
from app.services import reminders_service

logger = get_logger(__name__)
router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=ReminderRead)
async def get_reminders(current_user: CurrentUser, db: DbSession) -> ReminderRead:
    result = await db.execute(
        select(ReminderSettings).where(ReminderSettings.user_id == current_user.id)
    )
    return ReminderRead(**reminders_service.reminder_read(result.scalar_one_or_none()))


@router.put("", response_model=ReminderRead)
async def update_reminders(
    payload: ReminderUpdate, current_user: CurrentUser, db: DbSession
) -> ReminderRead:
    result = await db.execute(
        select(ReminderSettings).where(ReminderSettings.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = ReminderSettings(user_id=current_user.id)
        db.add(row)

    data = payload.model_dump(exclude_unset=True)
    if "enabled" in data and data["enabled"] is not None:
        row.enabled = bool(data["enabled"])
    if "reminder_hour" in data and data["reminder_hour"] is not None:
        row.reminder_hour = max(0, min(23, int(data["reminder_hour"])))
    if "telegram_chat_id" in data:
        chat_id = (data["telegram_chat_id"] or "").strip()
        row.telegram_chat_id = chat_id or None
    token = (data.get("telegram_bot_token") or "").strip()
    if token:
        row.telegram_token_encrypted = encrypt(token)

    await db.commit()
    await db.refresh(row)
    return ReminderRead(**reminders_service.reminder_read(row))


@router.post("/test", response_model=ReminderTestResult)
async def test_reminder(current_user: CurrentUser, db: DbSession) -> ReminderTestResult:
    result = await db.execute(
        select(ReminderSettings).where(ReminderSettings.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if row is None or not row.telegram_chat_id or not row.telegram_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guarda primero tu token de bot y tu chat ID de Telegram.",
        )
    try:
        await reminders_service.send_test(current_user.id)
    except Exception as exc:  # noqa: BLE001 - se devuelve el motivo al usuario
        logger.warning("Prueba de Telegram fallida: %s", exc)
        return ReminderTestResult(ok=False, message=str(exc))
    return ReminderTestResult(ok=True, message="Mensaje enviado. Revisa tu Telegram.")
