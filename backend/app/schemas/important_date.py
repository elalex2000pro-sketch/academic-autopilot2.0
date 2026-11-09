"""Esquemas de fechas importantes del planificador."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ImportantDateBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    date: date
    notes: str | None = None


class ImportantDateCreate(ImportantDateBase):
    pass


class ImportantDateRead(ImportantDateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
