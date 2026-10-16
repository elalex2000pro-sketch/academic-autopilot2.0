"""Esquemas del IA Studio (resumenes e infografias)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class StudioGenerateRequest(BaseModel):
    document_id: uuid.UUID
    kind: Literal["summary", "infographic"]


class AiOutputRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_document_id: uuid.UUID | None
    output_document_id: uuid.UUID | None
    kind: str
    title: str
    content: str
    source: str | None = None
    created_at: datetime


class StudioGenerateResponse(AiOutputRead):
    pass


class StudioListResponse(BaseModel):
    outputs: list[AiOutputRead]
