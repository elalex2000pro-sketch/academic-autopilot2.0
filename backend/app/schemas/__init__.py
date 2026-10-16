"""Punto de agregacion de todos los esquemas Pydantic."""
from app.schemas.assistant import (
    AssistantMessageRead,
    AssistantStatus,
    ChatRequest,
    ChatResponse,
)
from app.schemas.auth import Token, UserLogin, UserRead, UserRegister
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.schemas.file import DocumentRead
from app.schemas.grade import (
    CourseGradeSummary,
    GradeCreate,
    GradeRead,
    GradeSummary,
    GradeUpdate,
)
from app.schemas.schedule import (
    DailyAgenda,
    DailyAgendaItem,
    ScheduleBlockCreate,
    ScheduleBlockRead,
    ScheduleBlockUpdate,
)
from app.schemas.sync import (
    GoogleConnectRequest,
    IntegrationRead,
    MoodleConnectRequest,
    SyncLogRead,
    SyncRequest,
    SyncResult,
)
from app.schemas.task import (
    OptimizedPlan,
    OptimizedPlanItem,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from app.schemas.studio import (
    AiOutputRead,
    StudioGenerateRequest,
    StudioGenerateResponse,
    StudioListResponse,
)
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
)

__all__ = [
    "AssistantMessageRead",
    "AssistantStatus",
    "ChatRequest",
    "ChatResponse",
    "Token",
    "UserLogin",
    "UserRead",
    "UserRegister",
    "CourseCreate",
    "CourseRead",
    "CourseUpdate",
    "DocumentRead",
    "CourseGradeSummary",
    "GradeCreate",
    "GradeRead",
    "GradeSummary",
    "GradeUpdate",
    "DailyAgenda",
    "DailyAgendaItem",
    "ScheduleBlockCreate",
    "ScheduleBlockRead",
    "ScheduleBlockUpdate",
    "GoogleConnectRequest",
    "IntegrationRead",
    "MoodleConnectRequest",
    "SyncLogRead",
    "SyncRequest",
    "SyncResult",
    "OptimizedPlan",
    "OptimizedPlanItem",
    "TaskCreate",
    "TaskRead",
    "TaskUpdate",
    "TimetableEntryCreate",
    "TimetableEntryRead",
    "TimetableEntryUpdate",
    "AiOutputRead",
    "StudioGenerateRequest",
    "StudioGenerateResponse",
    "StudioListResponse",
]
