from types import SimpleNamespace

import httpx
import pytest

from app.services import ai_service, ai_studio_service
from app.services.ai_errors import AiProviderError, provider_error_message


@pytest.mark.parametrize("code,expected", [(401, "clave"), (403, "permisos"), (404, "modelo"), (429, "límite"), (503, "solicitud")])
def test_status_messages_do_not_expose_remote_details(code, expected):
    request = httpx.Request("POST", "https://example.com/?key=SECRET")
    error = httpx.HTTPStatusError("SECRET", request=request, response=httpx.Response(code, request=request))
    message = provider_error_message(error)
    assert expected in message
    assert "SECRET" not in message
    assert "example.com" not in message


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [httpx.ConnectError("SECRET"), httpx.ReadTimeout("SECRET")])
async def test_gemini_chat_reports_network_failure_without_heuristic(monkeypatch, error):
    async def context(*args):
        return {}
    async def fail(*args):
        raise error
    monkeypatch.setattr(ai_service, "build_context", context)
    monkeypatch.setattr(ai_service, "render_context_text", lambda ctx: "")
    monkeypatch.setattr(ai_service, "resolve_profile", lambda user: SimpleNamespace(provider="gemini", configured=True))
    monkeypatch.setattr(ai_service, "_run_model", fail)
    result = await ai_service.generate_reply(None, None, "hola", [])
    assert result.source == "error"
    assert "conexión" in result.reply
    assert "SECRET" not in result.reply


@pytest.mark.asyncio
async def test_gemini_document_generation_does_not_save_fake_success(monkeypatch):
    async def fail(*args):
        raise httpx.ConnectError("SECRET")
    monkeypatch.setattr(ai_studio_service, "extract_text", lambda doc: "texto")
    monkeypatch.setattr(ai_studio_service, "call_llm", fail)
    monkeypatch.setattr(ai_studio_service, "resolve_profile", lambda user: SimpleNamespace(provider="gemini"))
    with pytest.raises(AiProviderError, match="conexión"):
        await ai_studio_service.generate(None, None, None, "summary")
