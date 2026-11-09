"""Pruebas de la herramienta de calendario usada por Gemini."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.enums import TaskStatus
from app.services import ai_service, ai_tools
from app.services.ai_service import AiProfile


class _FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.committed = False

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, value: object) -> None:
        if getattr(value, "id", None) is None:
            value.id = uuid4()  # type: ignore[attr-defined]


def _user() -> SimpleNamespace:
    return SimpleNamespace(id=uuid4())


def test_schema_expone_la_herramienta_de_calendario() -> None:
    tools = ai_tools.tool_schemas()
    calendar = next(
        tool["function"]
        for tool in tools
        if tool["function"]["name"] == "add_event_to_calendar"
    )

    assert calendar["parameters"]["required"] == ["title", "date", "type"]
    assert calendar["parameters"]["properties"]["type"]["enum"] == [
        "exam",
        "task",
        "important_date",
    ]


@pytest.mark.asyncio
async def test_crea_un_examen_en_la_fecha_indicada() -> None:
    db = _FakeSession()
    payload, events = await ai_tools.execute_tool(
        db,  # type: ignore[arg-type]
        _user(),  # type: ignore[arg-type]
        "add_event_to_calendar",
        {"title": "Examen de Redes", "date": "2026-11-15", "type": "exam"},
    )

    assert payload["ok"] is True
    assert payload["type"] == "exam"
    assert payload["date"] == "2026-11-15"
    assert events == ["grades", "courses"]
    created = db.added[0]
    assert created.title == "Examen de Redes"  # type: ignore[attr-defined]
    assert created.is_exam is True  # type: ignore[attr-defined]
    assert created.score is None  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_crea_una_tarea_con_hora_y_prioridad() -> None:
    db = _FakeSession()
    payload, events = await ai_tools.execute_tool(
        db,  # type: ignore[arg-type]
        _user(),  # type: ignore[arg-type]
        "add_event_to_calendar",
        {
            "title": "Entregar práctica",
            "date": "2026-11-15",
            "time": "18:30",
            "type": "task",
        },
    )

    assert payload["ok"] is True
    assert payload["type"] == "task"
    assert payload["due_at"].startswith("2026-11-15T18:30")
    assert events == ["tasks", "courses"]
    created = db.added[0]
    assert created.status == TaskStatus.pending  # type: ignore[attr-defined]
    assert created.due_at.hour == 18  # type: ignore[attr-defined]
    assert created.due_at.minute == 30  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_crea_una_fecha_importante_sin_hora() -> None:
    db = _FakeSession()
    payload, events = await ai_tools.execute_tool(
        db,  # type: ignore[arg-type]
        _user(),  # type: ignore[arg-type]
        "add_event_to_calendar",
        {
            "title": "Matrícula de asignaturas",
            "date": "2026-12-01",
            "type": "important_date",
        },
    )

    assert payload["ok"] is True
    assert payload["type"] == "important_date"
    assert events == ["important_dates"]
    created = db.added[0]
    assert created.date.isoformat() == "2026-12-01"  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_rechaza_una_fecha_invalida() -> None:
    db = _FakeSession()
    payload, events = await ai_tools.execute_tool(
        db,  # type: ignore[arg-type]
        _user(),  # type: ignore[arg-type]
        "add_event_to_calendar",
        {"title": "Examen", "date": "15 de noviembre", "type": "exam"},
    )

    assert payload["ok"] is False
    assert "fecha" in payload["error"].lower()
    assert events == []
    assert db.added == []


@pytest.mark.asyncio
async def test_gemini_ejecuta_el_function_call_y_crea_el_evento(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _FakeSession()
    profile = AiProfile(
        provider="gemini",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        model="gemini-2.5-flash",
        vision_model="gemini-2.5-flash",
        api_key="clave",
        temperature=0.3,
        timeout_seconds=30,
        tools_enabled=True,
        max_tool_iterations=4,
    )
    calls = 0

    async def fake_post_gemini(*args: object, **kwargs: object) -> dict:
        nonlocal calls
        calls += 1
        if calls == 1:
            return {
                "parts": [
                    {
                        "functionCall": {
                            "name": "add_event_to_calendar",
                            "args": {
                                "title": "Examen de Redes",
                                "date": "2026-11-15",
                                "type": "exam",
                            },
                        }
                    }
                ]
            }
        return {"parts": [{"text": "He añadido el examen al calendario."}]}

    monkeypatch.setattr(ai_service, "_post_gemini", fake_post_gemini)
    result = await ai_service._run_model_gemini(
        db,  # type: ignore[arg-type]
        _user(),  # type: ignore[arg-type]
        profile,
        "SISTEMA",
        [],
        "Tengo un examen de redes el 15 de noviembre",
        [],
    )

    assert result.reply == "He añadido el examen al calendario."
    assert "grades" in result.events
    assert len(db.added) == 1
    assert db.added[0].title == "Examen de Redes"  # type: ignore[attr-defined]
    assert db.added[0].is_exam is True  # type: ignore[attr-defined]
    assert calls == 2
