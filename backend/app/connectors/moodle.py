"""Conector para Moodle Web Services (REST).

Doc de referencia: https://docs.moodle.org/dev/Web_service_API_functions
Se usa el endpoint unico `webservice/rest/server.php` con `wsfunction`.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

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


class MoodleConnector(BaseConnector):
    source = SourcePlatform.moodle

    def __init__(self, base_url: str, token: str, *, user_id: int | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.user_id = user_id  # id del usuario en Moodle (se resuelve en test_connection)
        self._endpoint = f"{self.base_url}/webservice/rest/server.php"

    # ------------------------------------------------------------------ #
    # Infraestructura interna
    # ------------------------------------------------------------------ #
    async def _call(self, function: str, params: dict | None = None) -> object:
        """Ejecuta una funcion de Moodle y normaliza errores."""
        payload: dict[str, str | int] = {
            "wstoken": self.token,
            "wsfunction": function,
            "moodlewsrestformat": "json",
        }
        # Moodle usa notacion por corchetes: courseids[0]=1
        for key, value in (params or {}).items():
            if isinstance(value, list):
                for index, item in enumerate(value):
                    payload[f"{key}[{index}]"] = item
            else:
                payload[key] = value

        try:
            async with httpx.AsyncClient(timeout=settings.moodle_timeout_seconds) as client:
                response = await client.post(self._endpoint, data=payload)
        except httpx.HTTPError as exc:
            raise ConnectorError("moodle", f"Error de red: {exc}") from exc

        if response.status_code != 200:
            raise ConnectorError(
                "moodle", f"HTTP {response.status_code}: {response.text[:200]}"
            )

        data = response.json()
        # Moodle devuelve errores como dict con clave 'exception' o 'errorcode'.
        if isinstance(data, dict) and ("exception" in data or "errorcode" in data):
            code = data.get("errorcode", "unknown")
            message = data.get("message", "Error desconocido de Moodle")
            raise ConnectorError("moodle", f"{code}: {message}", retriable=False)
        return data

    @staticmethod
    def _ts_to_dt(value: int | None) -> datetime | None:
        """Convierte un timestamp unix de Moodle a datetime UTC (0 = sin fecha)."""
        if not value:
            return None
        return datetime.fromtimestamp(int(value), tz=timezone.utc)

    # ------------------------------------------------------------------ #
    # API publica del conector
    # ------------------------------------------------------------------ #
    async def test_connection(self) -> dict:
        info = await self._call("core_webservice_get_site_info")
        if not isinstance(info, dict):
            raise ConnectorError("moodle", "Respuesta inesperada de site_info")
        self.user_id = int(info.get("userid", 0)) or None
        return {
            "sitename": info.get("sitename"),
            "username": info.get("username"),
            "userid": info.get("userid"),
            "release": info.get("release"),
        }

    async def fetch_courses(self) -> list[NormalizedCourse]:
        if self.user_id is None:
            await self.test_connection()
        raw = await self._call("core_enrol_get_users_courses", {"userid": self.user_id})
        if not isinstance(raw, list):
            return []
        courses: list[NormalizedCourse] = []
        for item in raw:
            courses.append(
                NormalizedCourse(
                    external_id=str(item.get("id")),
                    name=item.get("fullname") or item.get("shortname") or "Curso",
                    code=item.get("shortname"),
                )
            )
        return courses

    async def fetch_tasks(self) -> list[NormalizedTask]:
        courses = await self.fetch_courses()
        course_ids = [int(c.external_id) for c in courses]
        if not course_ids:
            return []

        raw = await self._call("mod_assign_get_assignments", {"courseids": course_ids})
        assignments_by_course = (raw or {}).get("courses", []) if isinstance(raw, dict) else []

        tasks: list[NormalizedTask] = []
        for course in assignments_by_course:
            course_ext_id = str(course.get("id"))
            for assign in course.get("assignments", []):
                due_at = self._ts_to_dt(assign.get("duedate"))
                tasks.append(
                    NormalizedTask(
                        external_id=str(assign.get("id")),
                        title=assign.get("name") or "Tarea sin titulo",
                        course_external_id=course_ext_id,
                        description=self._strip_html(assign.get("intro")),
                        due_at=due_at,
                        completed=False,
                        url=(
                            f"{self.base_url}/mod/assign/view.php?id={assign.get('cmid')}"
                            if assign.get("cmid")
                            else None
                        ),
                    )
                )
        return tasks

    @staticmethod
    def _strip_html(value: str | None) -> str | None:
        """Moodle devuelve HTML; lo reducimos a texto plano basico."""
        if not value:
            return None
        import re

        text = re.sub(r"<[^>]+>", " ", value)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:2000] or None
