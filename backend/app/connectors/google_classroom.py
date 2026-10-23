"""Conector para Google Classroom (Google Workspace API).

La libreria `google-api-python-client` es sincrona, por lo que cada llamada se
ejecuta en un hilo aparte (`asyncio.to_thread`) para no bloquear el event loop.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.connectors.base import (
    BaseConnector,
    ConnectorError,
    NormalizedCourse,
    NormalizedTask,
)
from app.core.config import settings
from app.core.logging import get_logger
from app.models.enums import SourcePlatform

logger = get_logger(__name__)

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_COMPLETED_STATES = {"TURNED_IN", "RETURNED"}


class GoogleClassroomConnector(BaseConnector):
    source = SourcePlatform.google_classroom

    def __init__(
        self,
        *,
        access_token: str | None,
        refresh_token: str | None,
        scopes: list[str] | None = None,
    ) -> None:
        self._access_token = access_token
        self._refresh_token = refresh_token
        self._scopes = scopes or settings.google_scopes_list

    # ------------------------------------------------------------------ #
    # Autenticacion
    # ------------------------------------------------------------------ #
    def _credentials(self) -> Credentials:
        creds = Credentials(
            token=self._access_token,
            refresh_token=self._refresh_token,
            token_uri=_TOKEN_URI,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scopes=self._scopes,
        )
        if not creds.valid:
            if not creds.refresh_token:
                raise ConnectorError(
                    "google_classroom", "Sin refresh_token; reautoriza la cuenta.", retriable=False
                )
            try:
                creds.refresh(Request())
            except Exception as exc:  # google.auth.exceptions.RefreshError
                raise ConnectorError(
                    "google_classroom", f"No se pudo refrescar el token: {exc}", retriable=False
                ) from exc
        return creds

    def _service(self):
        return build("classroom", "v1", credentials=self._credentials(), cache_discovery=False)

    async def _run(self, func, *args, **kwargs) -> Any:
        """Ejecuta una llamada sincrona de google-api en un hilo."""
        try:
            return await asyncio.to_thread(func, *args, **kwargs)
        except HttpError as exc:
            status = getattr(exc.resp, "status", None)
            retriable = status in (429, 500, 503)
            raise ConnectorError(
                "google_classroom",
                f"HttpError {status}: {exc.reason or exc}",
                retriable=retriable,
            ) from exc

    # ------------------------------------------------------------------ #
    # API publica del conector
    # ------------------------------------------------------------------ #
    async def test_connection(self) -> dict:
        service = await self._run(self._service)
        result = await self._run(
            lambda: service.courses().list(pageSize=1, courseStates=["ACTIVE"]).execute()
        )
        return {"ok": True, "courses_visible": len(result.get("courses", []))}

    async def fetch_courses(self) -> list[NormalizedCourse]:
        service = await self._run(self._service)
        courses: list[NormalizedCourse] = []
        page_token: str | None = None
        while True:
            kwargs: dict[str, Any] = {"pageSize": 100, "courseStates": ["ACTIVE"]}
            if page_token:
                kwargs["pageToken"] = page_token
            response = await self._run(lambda kw=kwargs: service.courses().list(**kw).execute())
            for item in response.get("courses", []):
                courses.append(
                    NormalizedCourse(
                        external_id=str(item.get("id")),
                        name=item.get("name") or "Curso",
                        code=item.get("section"),
                    )
                )
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return courses

    async def fetch_tasks(self) -> list[NormalizedTask]:
        service = await self._run(self._service)
        courses = await self.fetch_courses()
        tasks: list[NormalizedTask] = []

        for course in courses:
            course_id = course.external_id
            page_token: str | None = None
            while True:
                kwargs: dict[str, Any] = {
                    "courseId": course_id,
                    "pageSize": 100,
                    "courseWorkStates": ["PUBLISHED"],
                }
                if page_token:
                    kwargs["pageToken"] = page_token
                response = await self._run(
                    lambda kw=kwargs: service.courses().courseWork().list(**kw).execute()
                )
                for work in response.get("courseWork", []):
                    completed, completion_known = await self._submission_state(
                        service, course_id, work.get("id")
                    )
                    tasks.append(
                        NormalizedTask(
                            external_id=str(work.get("id")),
                            title=work.get("title") or "Trabajo sin titulo",
                            course_external_id=course_id,
                            description=work.get("description"),
                            due_at=self._parse_due(work.get("dueDate"), work.get("dueTime")),
                            completed=completed,
                            completion_known=completion_known,
                            url=work.get("alternateLink"),
                            extra={
                                "max_points": work.get("maxPoints"),
                                "work_type": work.get("workType"),
                            },
                        )
                    )
                page_token = response.get("nextPageToken")
                if not page_token:
                    break
        return tasks

    async def _submission_state(
        self, service, course_id: str, coursework_id: str | None
    ) -> tuple[bool, bool]:
        """Devuelve (entregada, estado_fiable) para el alumno actual ('me').

        `completion_known=False` evita que un fallo de permisos se interprete
        como "no entregada" y reabra una tarea que el usuario completo.
        """
        if not coursework_id:
            return False, False
        try:
            response = await self._run(
                lambda: service.courses()
                .courseWork()
                .studentSubmissions()
                .list(courseId=course_id, courseWorkId=coursework_id, userId="me")
                .execute()
            )
        except ConnectorError as exc:
            # La falta de permiso para ver submissions no debe romper el sync.
            logger.debug("No se pudo leer submission %s: %s", coursework_id, exc)
            return False, False
        submissions = response.get("studentSubmissions", [])
        return any(self._submission_is_completed(item) for item in submissions), True

    @staticmethod
    def _submission_is_completed(submission: dict[str, Any]) -> bool:
        """Una entrega cuenta como hecha si se entrego o ya se devolvio."""
        return submission.get("state") in _COMPLETED_STATES

    @staticmethod
    def _parse_due(due_date: dict | None, due_time: dict | None) -> datetime | None:
        """Google da la fecha y hora por separado. Las unimos en UTC."""
        if not due_date:
            return None
        try:
            return datetime(
                year=int(due_date.get("year")),
                month=int(due_date.get("month")),
                day=int(due_date.get("day")),
                hour=int((due_time or {}).get("hours", 23)),
                minute=int((due_time or {}).get("minutes", 59)),
                tzinfo=timezone.utc,
            )
        except (TypeError, ValueError):
            return None
