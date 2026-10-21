"""Conectores de plataformas externas."""
from app.connectors.base import (
    BaseConnector,
    ConnectorError,
    NormalizedCourse,
    NormalizedTask,
)
from app.connectors.google_classroom import GoogleClassroomConnector
from app.connectors.moodle import MoodleConnector

__all__ = [
    "BaseConnector",
    "ConnectorError",
    "NormalizedCourse",
    "NormalizedTask",
    "GoogleClassroomConnector",
    "MoodleConnector",
]
