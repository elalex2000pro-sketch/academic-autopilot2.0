"""Esquemas de calificaciones (notas)."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class GradeBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    course_id: uuid.UUID | None = None
    score: float | None = Field(default=None, ge=0)
    max_score: float = Field(default=10.0, gt=0)
    weight: float | None = Field(default=None, ge=0)
    graded_at: date | None = None
    notes: str | None = None
    trimester: int | None = Field(default=None, ge=1, le=3, strict=True)
    unit: str | None = Field(default=None, max_length=80)
    # True para examenes: se muestran en el calendario del planificador.
    is_exam: bool = False


class GradeCreate(GradeBase):
    pass


class GradeUpdate(BaseModel):
    trimester: int | None = Field(default=None, ge=1, le=3, strict=True)
    unit: str | None = Field(default=None, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=300)
    course_id: uuid.UUID | None = None
    score: float | None = Field(default=None, ge=0)
    max_score: float | None = Field(default=None, gt=0)
    weight: float | None = Field(default=None, ge=0)
    graded_at: date | None = None
    notes: str | None = None
    # No admite null: la columna es NOT NULL. Al no enviarse, no se modifica.
    is_exam: bool = False


class GradeRead(GradeBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    percentage: float | None = None
    created_at: datetime
    updated_at: datetime


class UnitGradeSummary(BaseModel):
    unit: str | None
    average_percent: float | None
    graded_count: int


class TermGradeSummary(BaseModel):
    trimester: int | None
    average_percent: float | None
    graded_count: int
    units: list[UnitGradeSummary]


class CourseGradeSummary(BaseModel):
    course_id: uuid.UUID | None
    course_name: str | None
    average_percent: float | None
    graded_count: int
    total_weight: float | None
    terms: list[TermGradeSummary] = Field(default_factory=list)


class GradeSummary(BaseModel):
    overall_average_percent: float | None
    graded_count: int
    courses: list[CourseGradeSummary]
