"""Esquemas del horario semanal (clases)."""
from __future__ import annotations

import uuid
from datetime import time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimetableImportRequest(BaseModel):
    document_id: uuid.UUID
    replace: bool = False


class TimetableImportResult(BaseModel):
    created: int
    source: str
    entries: list["TimetableEntryRead"]


class TimetableEntryBase(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Lunes .. 6=Domingo")
    start_time: time
    end_time: time
    title: str | None = Field(default=None, max_length=300)
    course_id: uuid.UUID | None = None
    location: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _check_range(self) -> "TimetableEntryBase":
        if self.start_time >= self.end_time:
            raise ValueError("start_time debe ser anterior a end_time")
        return self


class TimetableEntryCreate(TimetableEntryBase):
    pass


class TimetableEntryUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    title: str | None = Field(default=None, max_length=300)
    course_id: uuid.UUID | None = None
    location: str | None = Field(default=None, max_length=200)


class TimetableEntryRead(TimetableEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


TimetableImportResult.model_rebuild()
