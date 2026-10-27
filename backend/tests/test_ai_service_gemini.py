"""Pruebas de la ruta nativa de Gemini (payloads, sin llamar a la API)."""
from __future__ import annotations

import pytest

from app.services.ai_service import (
    _VISUAL_PROMPT,
    AiProfile,
    _gemini_contents,
    _gemini_native_url,
    _gemini_schema,
    _gemini_tools,
    _split_data_url,
)


def profile(base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/") -> AiProfile:
    return AiProfile(
        provider="gemini",
        base_url=base_url,
        model="gemini-2.5-flash",
        vision_model="gemini-2.5-flash",
        api_key="clave",
        temperature=0.3,
        timeout_seconds=60,
        tools_enabled=True,
        max_tool_iterations=6,
    )


def test_url_nativa_quita_openai():
    url = _gemini_native_url(profile(), "gemini-2.5-flash")
    assert url == (
        "https://generativelanguage.googleapis.com/v1beta/"
        "models/gemini-2.5-flash:generateContent"
    )


def test_url_nativa_sin_openai():
    url = _gemini_native_url(
        profile("https://generativelanguage.googleapis.com/v1beta"), "gemini-2.5-flash"
    )
    assert url.endswith("/v1beta/models/gemini-2.5-flash:generateContent")


def test_contenido_agrupa_turnos_y_adjunta_inline_data():
    contents = _gemini_contents(
        [
            {"role": "user", "content": "hola"},
            {"role": "assistant", "content": "¿qué tal?"},
            {"role": "user", "content": "   "},
            {"role": "assistant", "content": "respuesta"},
        ],
        "",
        ["data:image/jpeg;base64,QUJD"],
    )

    assert [item["role"] for item in contents] == ["user", "model", "user"]
    assert contents[0]["parts"] == [{"text": "hola"}]
    assert contents[1]["parts"] == [{"text": "¿qué tal?"}, {"text": "respuesta"}]
    assert contents[2]["parts"] == [
        {"text": _VISUAL_PROMPT},
        {"inlineData": {"mimeType": "image/jpeg", "data": "QUJD"}},
    ]


def test_contenido_con_texto_no_usa_prompt_visual():
    contents = _gemini_contents([], "resuelve esto", ["data:image/png;base64,QUJD"])
    assert contents[0]["parts"][0] == {"text": "resuelve esto"}


def test_split_data_url_valida():
    assert _split_data_url("data:image/webp;base64,QUJD") == ("image/webp", "QUJD")


@pytest.mark.parametrize(
    "value",
    [
        "https://ejemplo.com/foto.jpg",
        "data:image/png,QUJD",
        "data:image/png;base64",
    ],
)
def test_split_data_url_rechaza_formatos_no_validos(value: str):
    with pytest.raises(ValueError):
        _split_data_url(value)


def test_esquema_gemini_adapta_tipos_y_quita_extras():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Título"},
            "tags": {"type": "array", "items": {"type": "string"}},
            "done": {"type": "boolean", "nullable": True},
        },
        "required": ["title"],
        "additionalProperties": False,
    }

    result = _gemini_schema(schema)

    assert result["type"] == "OBJECT"
    assert result["properties"]["title"] == {"type": "STRING", "description": "Título"}
    assert result["properties"]["tags"] == {
        "type": "ARRAY",
        "items": {"type": "STRING"},
    }
    assert result["properties"]["done"] == {"type": "BOOLEAN", "nullable": True}
    assert result["required"] == ["title"]
    assert "additionalProperties" not in result


def test_herramientas_gemini_convierten_declaraciones():
    tools = [
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Crea una tarea",
                "parameters": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}},
                    "required": ["title"],
                },
            },
        }
    ]

    result = _gemini_tools(tools)

    assert result == [
        {
            "functionDeclarations": [
                {
                    "name": "create_task",
                    "description": "Crea una tarea",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {"title": {"type": "STRING"}},
                        "required": ["title"],
                    },
                }
            ]
        }
    ]
