"""Esquemas de cursos/asignaturas (gestion manual)."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SourcePlatform


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: SourcePlatform
    external_id: str
    name: str
    code: str | None
    color: str | None


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    code: str | None = Field(default=None, max_length=120)
    color: str | None = Field(default=None, max_length=16)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=500)
    code: str | None = Field(default=None, max_length=120)
    color: str | None = Field(default=None, max_length=16)
