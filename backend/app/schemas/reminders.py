"""Esquemas de enfoque (Pomodoro) y recordatorios."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FocusSessionCreate(BaseModel):
    minutes: int = Field(ge=1, le=240)
    kind: Literal["focus", "break"] = "focus"


class FocusSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    minutes: int
    kind: str
    finished_at: datetime


class FocusDay(BaseModel):
    date: str
    minutes: int


class FocusStats(BaseModel):
    today_minutes: int
    week_minutes: int
    streak_days: int
    total_sessions: int
    days: list[FocusDay]


class ReminderRead(BaseModel):
    enabled: bool
    reminder_hour: int
    telegram_chat_id: str | None
    has_token: bool


class ReminderUpdate(BaseModel):
    enabled: bool | None = None
    reminder_hour: int | None = Field(default=None, ge=0, le=23)
    telegram_chat_id: str | None = Field(default=None, max_length=64)
    telegram_bot_token: str | None = Field(default=None, max_length=200)


class ReminderTestResult(BaseModel):
    ok: bool
    message: str
