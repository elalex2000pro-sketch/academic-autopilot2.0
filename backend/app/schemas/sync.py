"""Esquemas de sincronizacion e integraciones."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IntegrationStatus, Provider, SyncStatus


class MoodleConnectRequest(BaseModel):
    base_url: str = Field(..., description="URL raiz de tu Moodle, ej. https://moodle.univ.edu")
    token: str = Field(..., min_length=8, description="Token de Web Services del usuario")


class GoogleConnectRequest(BaseModel):
    """Codigo de autorizacion devuelto por el flujo OAuth2 de Google."""

    code: str
    state: str | None = None


class IntegrationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: Provider
    status: IntegrationStatus
    base_url: str | None
    expires_at: datetime | None
    meta: dict[str, Any]
    created_at: datetime


class SyncRequest(BaseModel):
    """Opcional: limitar la sincronizacion a un proveedor."""

    provider: Provider = Provider.all


class SyncLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: Provider
    status: SyncStatus
    started_at: datetime
    finished_at: datetime | None
    created: int
    updated: int
    removed: int
    message: str | None
    errors: list[dict[str, Any]]


class SyncResult(BaseModel):
    provider: Provider
    status: SyncStatus
    created: int = 0
    updated: int = 0
    removed: int = 0
    message: str | None = None
    errors: list[dict[str, Any]] = Field(default_factory=list)
