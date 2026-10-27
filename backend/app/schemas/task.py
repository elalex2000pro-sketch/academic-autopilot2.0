"""Esquemas de tareas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SourcePlatform, TaskPriority, TaskStatus


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


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID | None
    source: SourcePlatform
    external_id: str
    status: TaskStatus
    priority: TaskPriority
    target_start_at: datetime | None
    target_end_at: datetime | None
    parent_task_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


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
