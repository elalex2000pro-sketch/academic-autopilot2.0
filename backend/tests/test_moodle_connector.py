"""Pruebas unitarias del conector de Moodle (sin red)."""
from __future__ import annotations

import pytest

from app.connectors.base import ConnectorError
from app.connectors.moodle import MoodleConnector


def _connector(user_id: int = 42) -> MoodleConnector:
    return MoodleConnector(
        base_url="https://moodle.universidad.edu/login/index.php",
        token=" test-token-123 ",
        user_id=user_id,
    )


@pytest.mark.asyncio
async def test_completed_assignments_filters_by_user(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _connector()

    async def fake_call(function: str, params: dict | None = None) -> object:
        assert function == "mod_assign_get_submissions"
        assert params == {"assignmentids": [1, 2]}
        return {
            "assignments": [
                {
                    "assignmentid": 1,
                    "submissions": [{"userid": 42, "status": "submitted"}],
                },
                {
                    "assignmentid": 2,
                    "submissions": [
                        {"userid": 99, "status": "submitted"},
                        {"userid": 42, "status": "draft"},
                    ],
                },
            ],
            "warnings": [],
        }

    monkeypatch.setattr(connector, "_call", fake_call)

    completed, known = await connector._completed_assignments([1, 2])
    assert completed == {1}
    assert known is True


@pytest.mark.asyncio
async def test_completed_assignments_are_unknown_without_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = _connector()

    async def fake_call(function: str, params: dict | None = None) -> object:
        raise ConnectorError("moodle", "accessexception: sin permiso", retriable=False)

    monkeypatch.setattr(connector, "_call", fake_call)

    completed, known = await connector._completed_assignments([1])
    assert completed == set()
    assert known is False


def test_strip_html() -> None:
    assert MoodleConnector._strip_html("<p>Hola &amp; adios</p>") == "Hola & adios"
    assert MoodleConnector._strip_html(None) is None


def test_base_url_is_normalized() -> None:
    connector = _connector()
    assert connector.base_url == "https://moodle.universidad.edu"
    assert connector.token == "test-token-123"
