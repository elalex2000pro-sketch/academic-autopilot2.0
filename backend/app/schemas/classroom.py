"""Esquemas de clases compartidas (codigo, chat, calendario y miembros)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ClassJoin(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class ClassMemberRead(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    joined_at: datetime


class ClassRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    code: str
    owner_id: uuid.UUID
    created_at: datetime
    member_count: int = 0
    my_role: str = "member"


class ClassDetail(ClassRead):
    members: list[ClassMemberRead] = []


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    kind: str = Field(default="message", pattern="^(message|announcement)$")


class MessageUpdate(BaseModel):
    pinned: bool


class MessageRead(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    user_id: uuid.UUID
    author_name: str | None = None
    content: str
    kind: str
    pinned: bool
    created_at: datetime


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)
    start_at: datetime
    end_at: datetime | None = None
    all_day: bool = False
    # Marca de examen: se resalta en el calendario de toda la clase.
    is_exam: bool = False


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    is_exam: bool | None = None


class EventRead(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    created_by: uuid.UUID
    creator_name: str | None = None
    title: str
    description: str | None
    location: str | None
    start_at: datetime
    end_at: datetime | None
    all_day: bool
    is_exam: bool = False
    created_at: datetime


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None


class AssignmentCompletionUpdate(BaseModel):
    completed: bool


class AssignmentRead(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    created_by: uuid.UUID
    creator_name: str | None = None
    title: str
    description: str | None
    due_at: datetime | None
    created_at: datetime
    my_completed: bool = False
    completed_count: int = 0
    total_members: int = 0
