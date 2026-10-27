"""Esquemas de autenticacion."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=200)
    timezone: str = "UTC"
    # Recuperacion opcional en el momento del registro.
    recovery_question: str | None = Field(default=None, max_length=200)
    recovery_answer: str | None = Field(default=None, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    timezone: str
    created_at: datetime
    recovery_question: str | None = None
    has_recovery: bool = False


class RecoveryQuestionRequest(BaseModel):
    email: EmailStr


class RecoveryQuestionRead(BaseModel):
    available: bool
    question: str | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr
    answer: str = Field(min_length=2, max_length=72)
    new_password: str = Field(min_length=8, max_length=128)


class RecoverySetup(BaseModel):
    question: str = Field(min_length=4, max_length=200)
    answer: str = Field(min_length=2, max_length=72)
