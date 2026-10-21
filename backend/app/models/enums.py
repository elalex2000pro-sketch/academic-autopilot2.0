"""Enums compartidos por modelos y esquemas."""
from __future__ import annotations

import enum


class SourcePlatform(str, enum.Enum):
    """Plataforma de origen de un curso o tarea."""

    moodle = "moodle"
    google_classroom = "google_classroom"
    manual = "manual"


class Provider(str, enum.Enum):
    """Proveedor de integracion (para Integration y SyncLog)."""

    moodle = "moodle"
    google_classroom = "google_classroom"
    all = "all"


class TaskPriority(str, enum.Enum):
    urgent = "urgent"
    long_project = "long_project"
    short_task = "short_task"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    archived = "archived"


class IntegrationStatus(str, enum.Enum):
    connected = "connected"
    error = "error"
    disabled = "disabled"


class SyncStatus(str, enum.Enum):
    success = "success"
    partial = "partial"
    error = "error"
