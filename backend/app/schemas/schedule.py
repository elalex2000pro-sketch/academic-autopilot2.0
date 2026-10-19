"""Esquemas de disponibilidad horaria y agenda."""
from __future__ import annotations

import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import TaskPriority


class ScheduleBlockBase(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Lunes .. 6=Domingo")
    start_time: time
    end_time: time
    label: str | None = Field(default=None, max_length=120)
    is_active: bool = True

    @model_validator(mode="after")
    def _check_range(self) -> "ScheduleBlockBase":
        if self.start_time >= self.end_time:
            raise ValueError("start_time debe ser anterior a end_time")
        return self


class ScheduleBlockCreate(ScheduleBlockBase):
    pass


class ScheduleBlockUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    label: str | None = None
    is_active: bool | None = None


class ScheduleBlockRead(ScheduleBlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class DailyAgendaItem(BaseModel):
    """Item de la agenda de un dia concreto."""

    task_id: uuid.UUID
    title: str
    course_name: str | None
    priority: TaskPriority
    start_at: datetime
    end_at: datetime
    completed: bool


class DailyAgenda(BaseModel):
    day: date
    items: list[DailyAgendaItem]
    total_minutes: int
    completed_minutes: int
    progress_percent: float
