"""Motor de sincronizacion automatica.

Orquesta los conectores, hace upsert idempotente de cursos y tareas, detecta
elementos huerfanos y registra el resultado en `SyncLog`. Un fallo en una
plataforma no impide sincronizar la otra (se aisla por integracion).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors import (
    BaseConnector,
    ConnectorError,
    GoogleClassroomConnector,
    MoodleConnector,
    NormalizedCourse,
    NormalizedTask,
)
from app.core.crypto import decrypt
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.course import Course
from app.models.enums import (
    IntegrationStatus,
    Provider,
    SourcePlatform,
    SyncStatus,
    TaskPriority,
    TaskStatus,
)
from app.models.integration import Integration
from app.models.sync_log import SyncLog
from app.models.task import Task
from app.models.user import User
from app.services.planner_service import replan_user

logger = get_logger(__name__)

# Colores por defecto para diferenciar cursos en la UI.
_COLOR_PALETTE = [
    "#6366f1", "#f97316", "#10b981", "#ec4899", "#0ea5e9", "#eab308",
    "#8b5cf6", "#ef4444", "#14b8a6", "#f43f5e",
]


# --------------------------------------------------------------------------- #
# Construccion de conectores
# --------------------------------------------------------------------------- #
def build_connector(integration: Integration) -> BaseConnector:
    """Instancia el conector adecuado a partir de una `Integration` persistida."""
    token = decrypt(integration.token_enc)
    if integration.provider == Provider.moodle:
        return MoodleConnector(
            base_url=integration.base_url or "",
            token=token or "",
            user_id=(integration.meta or {}).get("userid"),
        )
    if integration.provider == Provider.google_classroom:
        return GoogleClassroomConnector(
            access_token=token,
            refresh_token=decrypt(integration.refresh_token_enc),
        )
    raise ConnectorError(str(integration.provider), "Proveedor no soportado", retriable=False)


# --------------------------------------------------------------------------- #
# API publica
# --------------------------------------------------------------------------- #
async def sync_user(
    session: AsyncSession,
    user: User,
    *,
    provider: Provider = Provider.all,
) -> list[dict]:
    """Sincroniza las integraciones del usuario y devuelve un resumen por proveedor."""
    integrations = await _active_integrations(session, user.id, provider)
    results: list[dict] = []

    for integration in integrations:
        result = await _sync_integration(session, user, integration)
        results.append(result)

    # Recalcular el plan una sola vez, tras actualizar todas las fuentes.
    if results and any(r["status"] != SyncStatus.error for r in results):
        try:
            await replan_user(session, user)
        except Exception as exc:  # noqa: BLE001 - el replan no debe romper el sync
            logger.exception("Fallo el replan tras el sync: %s", exc)

    if not results:
        results.append(
            {
                "provider": provider,
                "status": SyncStatus.success,
                "created": 0,
                "updated": 0,
                "removed": 0,
                "message": "No hay integraciones activas para sincronizar.",
                "errors": [],
            }
        )
    return results


async def sync_all_users(session: AsyncSession) -> None:
    """Job del worker: sincroniza a todos los usuarios con integraciones activas."""
    result = await session.execute(
        select(User)
        .join(Integration, Integration.user_id == User.id)
        .where(Integration.status == IntegrationStatus.connected)
        .distinct()
    )
    for user in result.scalars().all():
        try:
            await sync_user(session, user)
        except Exception as exc:  # noqa: BLE001 - nunca tumbar el worker
            logger.exception("Error sincronizando %s: %s", user.email, exc)


# --------------------------------------------------------------------------- #
# Internos
# --------------------------------------------------------------------------- #
async def _active_integrations(
    session: AsyncSession, user_id: uuid.UUID, provider: Provider
) -> list[Integration]:
    stmt = select(Integration).where(
        Integration.user_id == user_id,
        Integration.status != IntegrationStatus.disabled,
    )
    if provider != Provider.all:
        stmt = stmt.where(Integration.provider == provider)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _sync_integration(
    session: AsyncSession, user: User, integration: Integration
) -> dict:
    """Sincroniza una sola integracion y persiste su SyncLog."""
    started = utcnow()
    provider = integration.provider
    created = updated = removed = 0
    errors: list[dict] = []

    try:
        connector = build_connector(integration)
        courses = await connector.fetch_courses()
        await _upsert_courses(session, user, provider, courses)

        tasks = await connector.fetch_tasks()
        created, updated = await _upsert_tasks(session, user, provider, tasks)
        removed = await _archive_orphans(session, user, provider, tasks)

        integration.status = IntegrationStatus.connected
        status = SyncStatus.success
        message = f"{len(courses)} cursos, {len(tasks)} tareas."
    except ConnectorError as exc:
        logger.warning("Error de conector %s: %s", provider, exc)
        integration.status = IntegrationStatus.error
        status = SyncStatus.error
        message = str(exc)
        errors.append({"provider": str(provider), "message": str(exc)})
    except Exception as exc:  # noqa: BLE001 - red de seguridad
        logger.exception("Error inesperado en %s", provider)
        integration.status = IntegrationStatus.error
        status = SyncStatus.error
        message = f"Error inesperado: {exc}"
        errors.append({"provider": str(provider), "message": str(exc)})

    log = SyncLog(
        user_id=user.id,
        provider=provider,
        status=status,
        started_at=started,
        finished_at=utcnow(),
        created=created,
        updated=updated,
        removed=removed,
        message=message,
        errors=errors,
    )
    session.add(log)
    await session.commit()

    return {
        "provider": provider,
        "status": status,
        "created": created,
        "updated": updated,
        "removed": removed,
        "message": message,
        "errors": errors,
    }


async def _upsert_courses(
    session: AsyncSession,
    user: User,
    provider: Provider,
    courses: list[NormalizedCourse],
) -> None:
    source = _provider_to_source(provider)
    existing = await _course_map(session, user.id, source)
    for index, course in enumerate(courses):
        current = existing.get(course.external_id)
        if current is None:
            session.add(
                Course(
                    user_id=user.id,
                    source=source,
                    external_id=course.external_id,
                    name=course.name,
                    code=course.code,
                    color=course.color or _COLOR_PALETTE[index % len(_COLOR_PALETTE)],
                )
            )
        else:
            current.name = course.name
            current.code = course.code or current.code
    await session.flush()


async def _upsert_tasks(
    session: AsyncSession,
    user: User,
    provider: Provider,
    tasks: list[NormalizedTask],
) -> tuple[int, int]:
    source = _provider_to_source(provider)
    course_map = await _course_map(session, user.id, source)
    existing = await _task_map(session, user.id, source)
    created = updated = 0

    for item in tasks:
        course = course_map.get(item.course_external_id) if item.course_external_id else None
        current = existing.get(item.external_id)

        if current is None:
            session.add(
                Task(
                    user_id=user.id,
                    course_id=course.id if course else None,
                    source=source,
                    external_id=item.external_id,
                    title=item.title,
                    description=item.description,
                    due_at=item.due_at,
                    estimated_minutes=60,
                    priority=_initial_priority(item.due_at),
                    status=(
                        TaskStatus.completed
                        if item.completion_known and item.completed
                        else TaskStatus.pending
                    ),
                )
            )
            created += 1
            continue

        # Una tarea archivada es una eliminacion del usuario. Aunque el origen
        # la siga devolviendo, no debe resucitar en la lista.
        if current.status == TaskStatus.archived:
            continue

        # Actualizacion de campos relevantes.
        changed = False
        if current.title != item.title:
            current.title, changed = item.title, True
        if current.due_at != item.due_at:
            current.due_at, changed = item.due_at, True
        if item.description and current.description != item.description:
            current.description, changed = item.description, True
        if course and current.course_id != course.id:
            current.course_id, changed = course.id, True

        # El estado de entrega solo puede avanzar a completada. Nunca se
        # reabre una tarea que el usuario ya completo en la app: la fuente
        # externa puede no reflejar esa accion (o no permitir leer entregas).
        if item.completion_known and item.completed and current.status != TaskStatus.completed:
            current.status, changed = TaskStatus.completed, True

        if changed:
            updated += 1

    await session.flush()
    return created, updated


async def _archive_orphans(
    session: AsyncSession,
    user: User,
    provider: Provider,
    tasks: list[NormalizedTask],
) -> int:
    """Marca como archivadas las tareas que ya no existen en el origen."""
    source = _provider_to_source(provider)
    seen_ids = {item.external_id for item in tasks}
    result = await session.execute(
        select(Task).where(
            Task.user_id == user.id,
            Task.source == source,
            Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
        )
    )
    removed = 0
    orphan_ids = []
    for task in result.scalars().all():
        if task.external_id not in seen_ids:
            task.status = TaskStatus.archived
            orphan_ids.append(task.id)
            removed += 1
    if orphan_ids:
        # Las subtareas del planificador (source=manual) de una tarea archivada
        # dejan de tener sentido: se archivan tambien para que no queden
        # "fantasmas" en la agenda.
        sub_result = await session.execute(
            select(Task).where(
                Task.parent_task_id.in_(orphan_ids),
                Task.status.in_([TaskStatus.pending, TaskStatus.in_progress]),
            )
        )
        for subtask in sub_result.scalars().all():
            subtask.status = TaskStatus.archived
    await session.flush()
    return removed


async def _course_map(session: AsyncSession, user_id: uuid.UUID, source: SourcePlatform) -> dict:
    result = await session.execute(
        select(Course).where(Course.user_id == user_id, Course.source == source)
    )
    return {c.external_id: c for c in result.scalars().all()}


async def _task_map(session: AsyncSession, user_id: uuid.UUID, source: SourcePlatform) -> dict:
    result = await session.execute(
        select(Task).where(Task.user_id == user_id, Task.source == source)
    )
    return {t.external_id: t for t in result.scalars().all()}


def _provider_to_source(provider: Provider) -> SourcePlatform:
    return SourcePlatform(provider.value)


def _initial_priority(due_at: datetime | None) -> TaskPriority:
    if due_at is None:
        return TaskPriority.short_task
    now = utcnow()
    due = due_at if due_at.tzinfo else due_at.replace(tzinfo=timezone.utc)
    if due - now <= timedelta(hours=72):
        return TaskPriority.urgent
    return TaskPriority.short_task
