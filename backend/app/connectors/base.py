"""Interfaz comun de conectores y DTOs normalizados.

Cada plataforma (Moodle, Google Classroom, ...) implementa `BaseConnector` y
transforma sus respuestas propietarias en los DTOs de este modulo. Asi el
`sync_service` no conoce los detalles de cada API.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime

from app.models.enums import SourcePlatform


class ConnectorError(Exception):
    """Error recuperable al hablar con una plataforma externa."""

    def __init__(self, provider: str, message: str, *, retriable: bool = True) -> None:
        self.provider = provider
        self.retriable = retriable
        super().__init__(f"[{provider}] {message}")


@dataclass(slots=True)
class NormalizedCourse:
    external_id: str
    name: str
    code: str | None = None
    color: str | None = None


@dataclass(slots=True)
class NormalizedTask:
    external_id: str
    title: str
    course_external_id: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    completed: bool = False
    url: str | None = None
    extra: dict = field(default_factory=dict)


class BaseConnector(ABC):
    """Contrato minimo de un conector de plataforma."""

    source: SourcePlatform

    @abstractmethod
    async def fetch_courses(self) -> list[NormalizedCourse]:
        """Devuelve los cursos visibles para el usuario."""

    @abstractmethod
    async def fetch_tasks(self) -> list[NormalizedTask]:
        """Devuelve las tareas/entregas pendientes del usuario."""

    @abstractmethod
    async def test_connection(self) -> dict:
        """Valida credenciales y devuelve metadatos del usuario remoto."""
