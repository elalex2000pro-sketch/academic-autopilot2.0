"""Esquemas de tareas."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_serializer

from app.models.enums import DeliveryStatus, SourcePlatform, TaskPriority, TaskStatus


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    due_at: datetime | None = None
    estimated_minutes: int = Field(default=60, ge=5, le=60 * 40)
    priority: TaskPriority | None = None


class TaskCreate(TaskBase):
    course_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    due_at: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=60 * 40)
    course_id: uuid.UUID | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None


class TaskDeliveryDeclare(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str | None = Field(default=None, max_length=2000)
    url: HttpUrl | None = Field(default=None, max_length=2048)


class TaskSnooze(BaseModel):
    until: date | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID | None
    source: SourcePlatform
    external_id: str
    status: TaskStatus
    delivery_status: DeliveryStatus = DeliveryStatus.none
    snoozed_until: datetime | None = None
    delivered_at: datetime | None = None
    delivery_note: str | None = None
    delivery_url: str | None = None
    priority: TaskPriority
    target_start_at: datetime | None
    target_end_at: datetime | None
    parent_task_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("snoozed_until")
    def serialize_snooze(self, value: datetime | None):
        # SQLite de pruebas pierde el offset; las fechas se guardan en UTC.
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


class OverduePrompts(BaseModel):
    tasks: list[TaskRead]
    remaining: int


class OptimizedPlanItem(BaseModel):
    """Una sesion planificada lista para el dashboard."""

    task_id: uuid.UUID
    parent_task_id: uuid.UUID | None
    title: str
    course_name: str | None
    priority: TaskPriority
    estimated_minutes: int
    due_at: datetime | None
    effective_due_at: datetime | None
    start_at: datetime
    end_at: datetime


class OptimizedPlan(BaseModel):
    """Resultado completo de la planificacion."""

    generated_at: datetime
    scheduled: list[OptimizedPlanItem]
    unscheduled_task_ids: list[uuid.UUID]
    total_scheduled_minutes: int
