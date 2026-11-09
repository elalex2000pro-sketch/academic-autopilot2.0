"""Pruebas del contexto enviado al modelo y del fallback sin IA."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
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


def test_resolve_profile_usa_los_modelos_gemini_elegidos(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(ai_service.crypto, "decrypt", lambda _value: "clave")

    for model in ("gemini-1.5-flash", "gemini-1.5-pro"):
        user = SimpleNamespace(
            ai_provider="gemini",
            ai_model=model,
            ai_base_url=None,
            ai_api_key_encrypted="cifrada",
        )
        resolved = ai_service.resolve_profile(user)
        assert resolved.provider == "gemini"
        assert resolved.model == model
        assert resolved.vision_model == model


@pytest.mark.asyncio
async def test_actualizar_perfil_cambia_el_modelo(monkeypatch: pytest.MonkeyPatch):
    from app.api.v1.assistant import update_profile
    from app.schemas.assistant import AiProfileUpdate

    monkeypatch.setattr(ai_service.crypto, "decrypt", lambda _value: "clave")
    user = SimpleNamespace(
        ai_provider="gemini",
        ai_model="gemini-2.5-flash",
        ai_base_url=None,
        ai_api_key_encrypted="cifrada",
        email="estudiante@example.com",
    )

    class FakeDb:
        def add(self, _obj: object) -> None:
            return None

        async def commit(self) -> None:
            return None

        async def refresh(self, _obj: object) -> None:
            return None

    updated = await update_profile(
        AiProfileUpdate(provider="gemini", model="gemini-1.5-pro"),
        user,  # type: ignore[arg-type]
        FakeDb(),  # type: ignore[arg-type]
    )

    assert user.ai_model == "gemini-1.5-pro"
    assert updated.model == "gemini-1.5-pro"
    assert updated.provider == "gemini"


def test_contexto_del_pdf_se_inyecta_solo_en_el_prompt():
    system = ai_service._append_page_context(
        "BASE",
        "La mitocondria produce energia en forma de ATP.",
        "Biologia · pág. 12",
    )

    assert system.startswith("BASE")
    assert "La mitocondria produce energia" in system
    assert "Biologia · pág. 12" in system
    assert system.index("BASE") < system.index("La mitocondria")


def test_contexto_de_pdf_vacio_no_altera_el_prompt():
    assert ai_service._append_page_context("BASE", "   ", None) == "BASE"
    assert ai_service._append_page_context("BASE", None, "Libro") == "BASE"


def test_chat_request_acepta_el_contexto_de_la_pagina():
    from app.schemas.assistant import ChatRequest

    request = ChatRequest(
        message="Hazme un resumen",
        page_context="Texto del PDF",
        page_context_label="Biologia · págs. 12-14",
    )

    assert request.page_context == "Texto del PDF"
    assert request.page_context_label == "Biologia · págs. 12-14"


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
