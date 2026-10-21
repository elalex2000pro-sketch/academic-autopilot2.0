"""Esquemas de subidas por trozos (archivos grandes y reanudables)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UploadCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    size_bytes: int = Field(gt=0)
    content_type: str = Field(default="application/octet-stream", max_length=200)
    course_id: uuid.UUID | None = None
    class_id: uuid.UUID | None = None


class UploadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    size_bytes: int
    received_bytes: int
    chunk_size: int
    status: str
    created_at: datetime


class ChunkRead(BaseModel):
    received_bytes: int
    next_index: int
    chunk_size: int
