"""Regresiones del bug de tareas que reaparecian tras sincronizar."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.api.v1 import tasks as tasks_api
from app.connectors.base import ConnectorError, NormalizedTask
from app.connectors.google_classroom import GoogleClassroomConnector
from app.models.enums import Provider, TaskStatus
from app.services import sync_service


class _FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        return None


class _FakeResult:
    def __init__(self, items: list[object]) -> None:
        self._items = items

    def scalars(self) -> _FakeResult:
        return self

    def all(self) -> list[object]:
        return self._items


class _FakeDeleteSession:
    def __init__(self, subtasks: list[object]) -> None:
        self.subtasks = subtasks
        self.committed = False

    async def execute(self, statement: object) -> _FakeResult:
        return _FakeResult(self.subtasks)

    async def commit(self) -> None:
        self.committed = True


def _fake_user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4())


def _existing_task(**overrides: object) -> SimpleNamespace:
    values = {
        "title": "Tarea original",
        "due_at": None,
        "description": None,
        "course_id": None,
        "status": TaskStatus.pending,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_sync_does_not_reopen_completed_task(monkeypatch: pytest.MonkeyPatch) -> None:
    current = _existing_task(status=TaskStatus.completed)
    session = _FakeSession()

    async def fake_course_map(*args: object, **kwargs: object) -> dict:
        return {}

    async def fake_task_map(*args: object, **kwargs: object) -> dict:
        return {"ext-1": current}

    monkeypatch.setattr(sync_service, "_course_map", fake_course_map)
    monkeypatch.setattr(sync_service, "_task_map", fake_task_map)

    created, updated = await sync_service._upsert_tasks(
        session,
        _fake_user(),
        Provider.moodle,
        [
            NormalizedTask(
                external_id="ext-1",
                title="Tarea original",
                completed=False,
                completion_known=True,
            )
        ],
    )

    assert (created, updated) == (0, 0)
    assert current.status == TaskStatus.completed


@pytest.mark.asyncio
async def test_sync_does_not_resurrect_archived_task(monkeypatch: pytest.MonkeyPatch) -> None:
    current = _existing_task(status=TaskStatus.archived)
    session = _FakeSession()

    async def fake_course_map(*args: object, **kwargs: object) -> dict:
        return {}

    async def fake_task_map(*args: object, **kwargs: object) -> dict:
        return {"ext-1": current}

    monkeypatch.setattr(sync_service, "_course_map", fake_course_map)
    monkeypatch.setattr(sync_service, "_task_map", fake_task_map)

    created, updated = await sync_service._upsert_tasks(
        session,
        _fake_user(),
        Provider.moodle,
        [
            NormalizedTask(
                external_id="ext-1",
                title="Titulo cambiado en Moodle",
                completed=False,
                completion_known=True,
            )
        ],
    )

    assert (created, updated) == (0, 0)
    assert current.status == TaskStatus.archived
    assert current.title == "Tarea original"


@pytest.mark.asyncio
async def test_new_task_is_born_completed_when_source_says_submitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()

    async def fake_course_map(*args: object, **kwargs: object) -> dict:
        return {}

    async def fake_task_map(*args: object, **kwargs: object) -> dict:
        return {}

    monkeypatch.setattr(sync_service, "_course_map", fake_course_map)
    monkeypatch.setattr(sync_service, "_task_map", fake_task_map)

    created, updated = await sync_service._upsert_tasks(
        session,
        _fake_user(),
        Provider.google_classroom,
        [
            NormalizedTask(
                external_id="ext-new",
                title="Entrega ya enviada",
                completed=True,
                completion_known=True,
            )
        ],
    )

    assert (created, updated) == (1, 0)
    assert len(session.added) == 1
    assert session.added[0].status == TaskStatus.completed  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_delete_endpoint_archives_task_and_subtasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(id=uuid4(), status=TaskStatus.pending)
    subtask = SimpleNamespace(id=uuid4(), status=TaskStatus.pending)
    db = _FakeDeleteSession([subtask])
    user = SimpleNamespace(id=uuid4())

    async def fake_get_owned_task(*args: object, **kwargs: object) -> SimpleNamespace:
        return task

    monkeypatch.setattr(tasks_api, "_get_owned_task", fake_get_owned_task)
    monkeypatch.setattr(tasks_api, "notify", lambda *args, **kwargs: None)

    await tasks_api.delete_task(task.id, user, db)

    assert task.status == TaskStatus.archived
    assert subtask.status == TaskStatus.archived
    assert db.committed is True


def test_classroom_completion_accepts_submission_states() -> None:
    assert GoogleClassroomConnector._submission_is_completed({"state": "TURNED_IN"})
    assert GoogleClassroomConnector._submission_is_completed({"state": "RETURNED"})
    assert not GoogleClassroomConnector._submission_is_completed({"state": "CREATED"})
    assert not GoogleClassroomConnector._submission_is_completed({"state": "RECLAIMED_BY_STUDENT"})


@pytest.mark.asyncio
async def test_classroom_marks_completion_unknown_when_submissions_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = GoogleClassroomConnector(access_token="token", refresh_token="refresh")

    async def fake_run(*args: object, **kwargs: object) -> object:
        raise ConnectorError("google_classroom", "sin permiso", retriable=False)

    monkeypatch.setattr(connector, "_run", fake_run)

    completed, known = await connector._submission_state(object(), "course", "work")

    assert completed is False
    assert known is False
