"""Llamadas genericas a la IA del usuario (JSON y transcripcion de audio)."""
from __future__ import annotations

import base64
import json
import re
from typing import Any

import httpx

from app.core.config import settings
from app.models.user import User
from app.services.ai_service import resolve_profile


class AiNotConfigured(RuntimeError):
    """El usuario todavia no ha configurado una IA utilizable."""


async def generate_json(
    user: User,
    system: str,
    prompt: str,
    *,
    max_tokens: int = 1200,
    temperature: float = 0.4,
) -> dict[str, Any]:
    """Pide a la IA del usuario un objeto JSON valido."""
    profile = resolve_profile(user)
    if not profile.configured or not profile.api_key:
        raise AiNotConfigured(
            "Configura tu IA en Ajustes (Gemini, ChatGPT, Claude u OpenRouter) para usar esta funcion."
        )

    payload = {
        "model": profile.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "stream": False,
        "max_tokens": max_tokens,
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {profile.api_key}"}
    url = profile.base_url.rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=max(profile.timeout_seconds, 90)) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    content = ((data.get("choices") or [{}])[0].get("message", {}) or {}).get("content") or ""
    return _extract_json(content)


async def generate_json_with_image(
    user: User,
    system: str,
    prompt: str,
    image_bytes: bytes,
    mime: str,
    *,
    max_tokens: int = 1500,
) -> dict[str, Any]:
    """Pide a un modelo con vision que devuelva JSON a partir de una imagen."""
    profile = resolve_profile(user)
    if not profile.configured or not profile.api_key:
        raise AiNotConfigured(
            "Para leer una foto necesitas una IA con vision configurada en Ajustes (OpenAI o Gemini)."
        )
    encoded = base64.b64encode(image_bytes).decode("ascii")
    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{encoded}"},
                },
            ],
        },
    ]
    payload = {
        "model": profile.model,
        "messages": messages,
        "temperature": 0.2,
        "stream": False,
        "max_tokens": max_tokens,
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {profile.api_key}"}
    url = profile.base_url.rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=max(profile.timeout_seconds, 120)) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    content = ((data.get("choices") or [{}])[0].get("message", {}) or {}).get("content") or ""
    return _extract_json(content)


def _extract_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        data = json.loads(text[start : end + 1])
        if isinstance(data, dict):
            return data
    raise ValueError("La IA no devolvio un JSON valido")


async def transcribe_audio(
    user: User, filename: str, content: bytes, content_type: str
) -> str:
    """Transcribe audio con un endpoint compatible con OpenAI Whisper."""
    profile = resolve_profile(user)
    if not profile.api_key:
        raise AiNotConfigured(
            "La transcripcion necesita una clave de OpenAI (o un servicio compatible con Whisper) en Ajustes."
        )
    url = profile.base_url.rstrip("/") + "/audio/transcriptions"
    headers = {"Authorization": f"Bearer {profile.api_key}"}
    files = {"file": (filename, content, content_type or "audio/mpeg")}
    data = {"model": settings.ai_transcribe_model, "language": "es"}
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(url, headers=headers, files=files, data=data)
        response.raise_for_status()
        payload = response.json()
    text = (payload.get("text") or "").strip()
    if not text:
        raise RuntimeError("La transcripcion llego vacia")
    return text
