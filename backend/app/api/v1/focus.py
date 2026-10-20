"""Sesiones de enfoque (Pomodoro) y estadisticas de estudio."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.db.base import utcnow
from app.models.focus_session import FocusSession
from app.schemas.reminders import FocusDay, FocusSessionCreate, FocusSessionRead, FocusStats

router = APIRouter(prefix="/focus", tags=["focus"])


@router.post(
    "/sessions", response_model=FocusSessionRead, status_code=status.HTTP_201_CREATED
)
async def log_session(
    payload: FocusSessionCreate, current_user: CurrentUser, db: DbSession
) -> FocusSession:
    session = FocusSession(
        user_id=current_user.id, minutes=payload.minutes, kind=payload.kind
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[FocusSessionRead])
async def list_sessions(
    current_user: CurrentUser, db: DbSession, limit: int = Query(default=20, ge=1, le=100)
) -> list[FocusSession]:
    result = await db.execute(
        select(FocusSession)
        .where(FocusSession.user_id == current_user.id)
        .order_by(FocusSession.finished_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/stats", response_model=FocusStats)
async def focus_stats(current_user: CurrentUser, db: DbSession) -> FocusStats:
    now = utcnow()
    since = now - timedelta(days=60)
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.user_id == current_user.id,
            FocusSession.kind == "focus",
            FocusSession.finished_at >= since,
        )
    )
    sessions = list(result.scalars().all())

    per_day: dict[str, int] = {}
    for session in sessions:
        key = session.finished_at.date().isoformat()
        per_day[key] = per_day.get(key, 0) + session.minutes

    today = now.date()
    today_minutes = per_day.get(today.isoformat(), 0)
    week_days = [(today - timedelta(days=offset)) for offset in range(6, -1, -1)]
    week_minutes = sum(per_day.get(day.isoformat(), 0) for day in week_days)

    # Racha: dias consecutivos con al menos una sesion, contando hoy o ayer.
    streak = 0
    cursor = today if per_day.get(today.isoformat(), 0) > 0 else today - timedelta(days=1)
    while per_day.get(cursor.isoformat(), 0) > 0:
        streak += 1
        cursor -= timedelta(days=1)

    total_sessions = await db.scalar(
        select(func.count())
        .select_from(FocusSession)
        .where(FocusSession.user_id == current_user.id, FocusSession.kind == "focus")
    )

    return FocusStats(
        today_minutes=today_minutes,
        week_minutes=week_minutes,
        streak_days=streak,
        total_sessions=int(total_sessions or 0),
        days=[
            FocusDay(date=day.isoformat(), minutes=per_day.get(day.isoformat(), 0))
            for day in week_days
        ],
    )
