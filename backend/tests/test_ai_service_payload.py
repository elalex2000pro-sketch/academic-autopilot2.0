"""Pruebas del contexto enviado al modelo y del fallback sin IA."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from app.services import ai_service
from app.services.ai_service import AiProfile, heuristic_document_reply, heuristic_reply


def profile() -> AiProfile:
    return AiProfile(
        provider="openai",
        base_url="https://example.com/v1",
        model="modelo",
        vision_model="modelo",
        api_key="clave",
        temperature=0.3,
        timeout_seconds=30,
        tools_enabled=False,
        max_tool_iterations=2,
    )


@pytest.mark.asyncio
async def test_run_model_envia_historial_y_mensaje_actual(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: dict[str, Any] = {}

    async def fake_post_chat(
        _profile: AiProfile,
        messages: list[dict[str, Any]],
        model: str,
        tools: list[dict[str, Any]] | None,
    ) -> dict[str, Any]:
        captured.update(messages=messages, model=model, tools=tools)
        return {"content": "respuesta del modelo"}

    monkeypatch.setattr(ai_service, "_post_chat", fake_post_chat)

    result = await ai_service._run_model(
        None,  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        profile(),
        "SISTEMA",
        [
            {"role": "user", "content": "pregunta anterior"},
            {"role": "assistant", "content": "respuesta anterior"},
        ],
        "pregunta actual",
        [],
    )

    assert result.reply == "respuesta del modelo"
    assert result.source == "ai"
    assert captured["model"] == "modelo"
    assert captured["tools"] is None
    assert captured["messages"] == [
        {"role": "system", "content": "SISTEMA"},
        {"role": "user", "content": "pregunta anterior"},
        {"role": "assistant", "content": "respuesta anterior"},
        {"role": "user", "content": "pregunta actual"},
    ]


def test_fallback_usa_la_pregunta_y_no_repite_el_mismo_plan():
    ctx = {
        "tasks": [],
        "now": datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc),
        "availability": [],
    }

    first = heuristic_reply(ctx, "¿Qué es la fotosíntesis?")
    second = heuristic_reply(ctx, "¿Qué hago hoy?")

    assert "fotosíntesis" in first
    assert first != second
    assert "hoy" in second.lower()


def test_fallback_documental_busca_la_pregunta():
    text = (
        "La fotosíntesis transforma la energía solar en energía química.\n"
        "La clorofila captura la luz en los cloroplastos.\n"
        "La respiración celular ocurre en las mitocondrias."
    )

    answer = heuristic_document_reply("apuntes.pdf", text, "¿Qué hace la clorofila?")

    assert "clorofila" in answer.lower()
    assert "apuntes.pdf" in answer
    assert "mitocondrias" not in answer.lower()
