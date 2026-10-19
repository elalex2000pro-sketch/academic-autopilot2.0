"""Esquemas de documentos (archivos)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
