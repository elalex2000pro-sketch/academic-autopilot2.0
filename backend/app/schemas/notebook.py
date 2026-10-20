"""Esquemas de cuadernos de notas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NotebookCreate(BaseModel):
    title: str = Field(default="Cuaderno sin titulo", min_length=1, max_length=200)
    color: str = Field(default="#6366f1", max_length=20)
    content: str = Field(default="", max_length=200000)


class NotebookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=20)
    content: str | None = Field(default=None, max_length=200000)


class NotebookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    color: str
    content: str
    shared_class_id: uuid.UUID | None = None
    share_permission: str = "read"
    created_at: datetime
    updated_at: datetime


class NotebookSourceCreate(BaseModel):
    book_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None


class NotebookSourceRead(BaseModel):
    id: uuid.UUID
    notebook_id: uuid.UUID
    kind: Literal["book", "file"]
    title: str
    subtitle: str | None = None
    book_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None
    format: str | None = None
    size_bytes: int = 0
    created_at: datetime
