"""Exporta todos los modelos para que Alembic los descubra via metadata."""
from app.db.base import Base
from app.models.ai_output import AiOutput
from app.models.assistant_message import AssistantMessage
from app.models.book import Book, BookMessage, BookSection
from app.models.chat import ChatConversation, ChatMember, ChatMessage
from app.models.classwork import ClassAssignment, ClassAssignmentCompletion, ClassTopic, ClassWorkFile, ClassAssignmentAttachment, ClassWorkComment
from app.models.course import Course
from app.models.document import Document
from app.models.enums import (
    IntegrationStatus,
    Provider,
    SourcePlatform,
    SyncStatus,
    TaskPriority,
    TaskStatus,
)
from app.models.flashcard import Flashcard
from app.models.focus_session import FocusSession
from app.models.grade import Grade
from app.models.important_date import ImportantDate
from app.models.integration import Integration
from app.models.notebook import Notebook, NotebookSource, NotebookMessage, NotebookAction
from app.models.quiz import Quiz
from app.models.reminder_settings import ReminderSettings
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
    "Book",
    "BookMessage",
    "BookSection",
    "ChatConversation",
    "ChatMember",
    "ChatMessage",
    "ClassTopic",
    "ClassWorkFile",
    "ClassAssignmentAttachment",
    "ClassWorkComment",
    "ClassAssignment",
    "ClassAssignmentCompletion",
    "ClassEvent",
    "ClassMembership",
    "ClassMessage",
    "Course",
    "Document",
    "Flashcard",
    "FocusSession",
    "Grade",
    "ImportantDate",
    "Integration",
    "Notebook",
    "NotebookSource",
    "Quiz",
    "ReminderSettings",
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
