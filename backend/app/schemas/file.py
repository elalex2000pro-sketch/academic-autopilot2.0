"""Esquemas de documentos (archivos)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.text import normalize_filename


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID | None
    class_id: uuid.UUID | None = None
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime

    @field_validator("filename", mode="before")
    @classmethod
    def _normalize_filename(cls, value: str) -> str:
        return normalize_filename(value)
