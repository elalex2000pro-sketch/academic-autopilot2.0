"""Exporta todos los modelos para que Alembic los descubra via metadata."""
from app.db.base import Base
from app.models.course import Course
from app.models.enums import (
    IntegrationStatus,
    Provider,
    SourcePlatform,
    SyncStatus,
    TaskPriority,
    TaskStatus,
)
from app.models.ai_output import AiOutput
from app.models.assistant_message import AssistantMessage
from app.models.document import Document
from app.models.grade import Grade
from app.models.integration import Integration
from app.models.notebook import Notebook
from app.models.schedule_block import ScheduleBlock
from app.models.shared_class import (
    ClassEvent,
    ClassMembership,
    ClassMessage,
    SharedClass,
)
from app.models.sync_log import SyncLog
from app.models.task import Task
from app.models.timetable_entry import TimetableEntry
from app.models.upload_session import UploadSession
from app.models.user import User

__all__ = [
    "AiOutput",
    "AssistantMessage",
    "Base",
    "ClassEvent",
    "ClassMembership",
    "ClassMessage",
    "Course",
    "Document",
    "Grade",
    "Integration",
    "Notebook",
    "ScheduleBlock",
    "SharedClass",
    "SyncLog",
    "Task",
    "TimetableEntry",
    "UploadSession",
    "User",
    "IntegrationStatus",
    "Provider",
    "SourcePlatform",
    "SyncStatus",
    "TaskPriority",
    "TaskStatus",
]
