"""Conector para Moodle Web Services (REST).

Doc de referencia: https://docs.moodle.org/dev/Web_service_API_functions
Se usa el endpoint unico `webservice/rest/server.php` con `wsfunction`.
"""
from __future__ import annotations

import html
import re
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
from app.core.urls import normalize_moodle_base_url
from app.models.enums import SourcePlatform

logger = get_logger(__name__)

# El token debe poder leer cursos y tareas, no solo el site_info. Comprobarlo
# al conectar evita el clasico "Moodle conectado" con el sync roto despues.
_REQUIRED_FUNCTIONS = {
    "core_enrol_get_users_courses",
    "mod_assign_get_assignments",
}

# Estados de entrega que consideramos "hecho". Un borrador no cuenta.
_SUBMITTED_STATUSES = {"submitted", "graded"}


class MoodleConnector(BaseConnector):
    source = SourcePlatform.moodle

    def __init__(self, base_url: str, token: str, *, user_id: int | None = None) -> None:
        self.base_url = normalize_moodle_base_url(base_url)
        self.token = token.strip()
        if not self.token:
            raise ValueError("El token de Moodle no puede estar vacio.")
        self.user_id = user_id  # id del usuario en Moodle (se resuelve en test_connection)
        self._endpoint = f"{self.base_url}/webservice/rest/server.php"
        self._courses: list[NormalizedCourse] | None = None

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
            async with httpx.AsyncClient(
                timeout=settings.moodle_timeout_seconds,
                follow_redirects=True,
                headers={"User-Agent": "AcademicAutopilot/1.0"},
            ) as client:
                response = await client.post(self._endpoint, data=payload)
        except httpx.TimeoutException as exc:
            raise ConnectorError(
                "moodle",
                f"Tiempo de espera agotado ({settings.moodle_timeout_seconds}s). "
                "Comprueba que la URL sea accesible desde el servidor.",
                retriable=True,
            ) from exc
        except httpx.HTTPError as exc:
            raise ConnectorError("moodle", f"Error de red: {exc}", retriable=True) from exc

        if response.status_code != 200:
            detail = " ".join(response.text.strip().split())[:200]
            raise ConnectorError(
                "moodle",
                f"HTTP {response.status_code}: {detail or 'sin cuerpo'}",
                retriable=response.status_code >= 500 or response.status_code == 429,
            )

        try:
            data = response.json()
        except ValueError as exc:
            # Ocurre si se pega una URL que no es la raiz de Moodle, si el WAF
            # devuelve HTML o si el sitio redirige a una pagina de login.
            detail = " ".join(response.text.strip().split())[:200]
            message = (
                "La URL no parece ser la raiz de Moodle o el sitio devolvio HTML "
                "en vez de JSON."
            )
            if detail:
                message = f"{message} Respuesta: {detail}"
            raise ConnectorError("moodle", message, retriable=False) from exc

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
        try:
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
        except (TypeError, ValueError, OSError):
            return None

    # ------------------------------------------------------------------ #
    # API publica del conector
    # ------------------------------------------------------------------ #
    async def test_connection(self) -> dict:
        info = await self._call("core_webservice_get_site_info")
        if not isinstance(info, dict):
            raise ConnectorError("moodle", "Respuesta inesperada de site_info", retriable=False)

        try:
            user_id = int(info.get("userid"))
        except (TypeError, ValueError):
            user_id = 0
        if not user_id:
            raise ConnectorError(
                "moodle",
                "Moodle no devolvio un usuario valido para este token.",
                retriable=False,
            )
        self.user_id = user_id

        # site_info incluye las funciones que permite el servicio web del token.
        functions = info.get("functions")
        if isinstance(functions, list):
            available = {
                str(item.get("name"))
                for item in functions
                if isinstance(item, dict) and item.get("name")
            }
            missing = sorted(_REQUIRED_FUNCTIONS - available)
            if missing:
                raise ConnectorError(
                    "moodle",
                    "El token no tiene acceso a las funciones necesarias: "
                    f"{', '.join(missing)}. Revisa el servicio web asociado al token.",
                    retriable=False,
                )

        return {
            "sitename": info.get("sitename"),
            "username": info.get("username"),
            "userid": info.get("userid"),
            "release": info.get("release"),
        }

    async def fetch_courses(self) -> list[NormalizedCourse]:
        if self._courses is not None:
            return self._courses
        if self.user_id is None:
            await self.test_connection()

        raw = await self._call("core_enrol_get_users_courses", {"userid": self.user_id})
        if not isinstance(raw, list):
            raise ConnectorError(
                "moodle", "Respuesta inesperada al listar los cursos.", retriable=False
            )

        courses: list[NormalizedCourse] = []
        for item in raw:
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            courses.append(
                NormalizedCourse(
                    external_id=str(item.get("id")),
                    name=item.get("fullname") or item.get("shortname") or "Curso",
                    code=item.get("shortname"),
                )
            )
        self._courses = courses
        return courses

    async def fetch_tasks(self) -> list[NormalizedTask]:
        courses = await self.fetch_courses()
        course_ids = [
            int(course.external_id)
            for course in courses
            if course.external_id.isdigit()
        ]
        if not course_ids:
            return []

        raw = await self._call("mod_assign_get_assignments", {"courseids": course_ids})
        courses_payload = raw.get("courses", []) if isinstance(raw, dict) else []
        if not isinstance(courses_payload, list):
            raise ConnectorError(
                "moodle", "Respuesta inesperada al listar las tareas.", retriable=False
            )

        assignments: list[tuple[str, dict, int]] = []
        for course in courses_payload:
            if not isinstance(course, dict):
                continue
            course_external_id = str(course.get("id"))
            for assign in course.get("assignments", []) or []:
                if not isinstance(assign, dict):
                    continue
                try:
                    assignment_id = int(assign.get("id"))
                except (TypeError, ValueError):
                    continue
                assignments.append((course_external_id, assign, assignment_id))

        # El estado de entrega es opcional: si el servicio no permite consultarlo,
        # completion_known=False evita reabrir tareas completadas por el usuario.
        completed_ids, completion_known = await self._completed_assignments(
            [assignment_id for _, _, assignment_id in assignments]
        )

        tasks: list[NormalizedTask] = []
        for course_external_id, assign, assignment_id in assignments:
            tasks.append(
                NormalizedTask(
                    external_id=str(assignment_id),
                    title=assign.get("name") or "Tarea sin titulo",
                    course_external_id=course_external_id,
                    description=self._strip_html(assign.get("intro")),
                    due_at=self._ts_to_dt(assign.get("duedate")),
                    completed=assignment_id in completed_ids,
                    completion_known=completion_known,
                    url=(
                        f"{self.base_url}/mod/assign/view.php?id={assign.get('cmid')}"
                        if assign.get("cmid")
                        else None
                    ),
                )
            )
        return tasks

    async def _completed_assignments(self, assignment_ids: list[int]) -> tuple[set[int], bool]:
        """Devuelve los IDs de asignaciones entregadas y si el dato es fiable."""
        if not assignment_ids:
            return set(), True
        if self.user_id is None:
            # Sin el id del alumno no se puede distinguir su entrega de la de
            # otros companeros. Mejor no afirmar nada que marcar tareas ajenas.
            logger.info("Moodle sin userid: no se puede verificar el estado de entrega")
            return set(), False

        try:
            raw = await self._call(
                "mod_assign_get_submissions", {"assignmentids": assignment_ids}
            )
        except ConnectorError as exc:
            # La falta de permiso para ver entregas no debe romper el sync.
            logger.info("Moodle no permite consultar entregas: %s", exc)
            return set(), False

        if not isinstance(raw, dict):
            logger.warning("Moodle devolvio un formato inesperado en mod_assign_get_submissions")
            return set(), False

        completed: set[int] = set()
        for assignment in raw.get("assignments", []) or []:
            if not isinstance(assignment, dict):
                continue
            try:
                assignment_id = int(assignment.get("assignmentid"))
            except (TypeError, ValueError):
                continue
            for submission in assignment.get("submissions", []) or []:
                if not isinstance(submission, dict):
                    continue
                try:
                    user_id = int(submission.get("userid"))
                except (TypeError, ValueError):
                    user_id = None
                if user_id != self.user_id:
                    continue
                status = str(submission.get("status") or "").lower()
                if status in _SUBMITTED_STATUSES:
                    completed.add(assignment_id)
                    break
        return completed, True

    @staticmethod
    def _strip_html(value: str | None) -> str | None:
        """Moodle devuelve HTML; lo reducimos a texto plano basico."""
        if not value:
            return None
        text = re.sub(r"<[^>]+>", " ", value)
        text = html.unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:2000] or None
