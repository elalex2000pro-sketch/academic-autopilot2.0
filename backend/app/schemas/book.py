"""Esquemas de la biblioteca de libros completos."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BookImport(BaseModel):
    document_id: uuid.UUID
    title: str | None = Field(default=None, max_length=500)
    author: str | None = Field(default=None, max_length=300)
    course_id: uuid.UUID | None = None


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=300)
    cover_color: str | None = Field(default=None, max_length=20)
    course_id: uuid.UUID | None = None


class BookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID | None = None
    document_id: uuid.UUID | None = None
    title: str
    author: str | None = None
    format: str
    cover_color: str
    status: str
    error_message: str | None = None
    total_sections: int
    total_chars: int
    text_available: bool = True
    current_section_index: int
    progress_percent: float
    last_opened_at: datetime | None = None
    source_filename: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime
    current_section_title: str | None = None
    estimated_minutes: int = 0


class BookSectionMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_index: int
    title: str
    char_count: int
    page_start: int | None = None
    page_end: int | None = None


class BookSectionRead(BookSectionMeta):
    content: str


class BookDetail(BookRead):
    sections: list[BookSectionMeta]


class BookProgressUpdate(BaseModel):
    section_index: int = Field(ge=0)
    percent: float | None = Field(default=None, ge=0, le=100)


class BookCitation(BaseModel):
    section_id: uuid.UUID
    section_index: int
    title: str
    quote: str
    page_start: int | None = None
    page_end: int | None = None


class BookQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    section_index: int | None = Field(default=None, ge=0)


class BookAnswer(BaseModel):
    answer: str
    citations: list[BookCitation] = []
    source: Literal["ai", "extractive", "heuristic"] = "ai"
    notice: str | None = None
    created_at: datetime


class BookSummaryRequest(BaseModel):
    scope: Literal["current", "book"] = "current"
    section_index: int | None = Field(default=None, ge=0)


class BookSummary(BaseModel):
    title: str
    summary: str
    key_points: list[str] = []
    citations: list[BookCitation] = []
    source: Literal["ai", "extractive", "heuristic"] = "ai"
    notice: str | None = None


class BookMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    citations: list[BookCitation] = []
    source: str
    created_at: datetime
