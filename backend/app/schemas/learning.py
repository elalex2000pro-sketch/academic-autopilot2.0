"""Esquemas de flashcards y examenes."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FlashcardCreate(BaseModel):
    front: str = Field(min_length=1, max_length=2000)
    back: str = Field(min_length=1, max_length=4000)
    notebook_id: uuid.UUID | None = None


class FlashcardUpdate(BaseModel):
    front: str | None = Field(default=None, min_length=1, max_length=2000)
    back: str | None = Field(default=None, min_length=1, max_length=4000)


class FlashcardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    notebook_id: uuid.UUID | None
    front: str
    back: str
    source: str
    ease: float
    interval_days: int
    repetitions: int
    due_at: datetime
    created_at: datetime


class FlashcardReview(BaseModel):
    quality: int = Field(ge=0, le=5)


class FlashcardReviewResult(BaseModel):
    card: FlashcardRead
    next_due: datetime
    interval_days: int


class GenerateFromNotebook(BaseModel):
    notebook_id: uuid.UUID


class FlashcardBulkCreate(BaseModel):
    flashcards: list[FlashcardCreate] = Field(min_length=1, max_length=100)


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer: int
    explanation: str | None = None


class QuizRead(BaseModel):
    id: uuid.UUID
    notebook_id: uuid.UUID | None
    title: str
    source: str
    questions: list[QuizQuestion]
    score: int | None
    total: int
    completed_at: datetime | None
    created_at: datetime


class QuizSubmit(BaseModel):
    answers: list[int]


class QuizResult(BaseModel):
    quiz: QuizRead
    score: int
    total: int
    details: list[bool]


class FlashcardsGenerated(BaseModel):
    created: int
    source: str
    flashcards: list[FlashcardRead]
