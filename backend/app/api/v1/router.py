"""Router agregador de la API v1."""
from fastapi import APIRouter

from app.api.v1 import (
    assistant,
    auth,
    classes,
    courses,
    exports,
    files,
    grades,
    integrations,
    notebooks,
    realtime,
    schedule,
    studio,
    sync,
    tasks,
    timetable,
    uploads,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(integrations.router)
api_router.include_router(sync.router)
api_router.include_router(courses.router)
api_router.include_router(grades.router)
api_router.include_router(timetable.router)
api_router.include_router(tasks.router)
api_router.include_router(classes.router)
api_router.include_router(uploads.router)
api_router.include_router(files.router)
api_router.include_router(assistant.router)
api_router.include_router(schedule.router)
api_router.include_router(studio.router)
api_router.include_router(notebooks.router)
api_router.include_router(exports.router)
api_router.include_router(realtime.router)

__all__ = ["api_router"]
