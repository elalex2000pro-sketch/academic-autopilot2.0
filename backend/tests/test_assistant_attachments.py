"""Pruebas de la validacion de adjuntos del chat (funciones puras, sin BD)."""
from __future__ import annotations

import base64

import pytest
from fastapi import HTTPException

from app.api.v1.assistant import (
    _prepare_attachments,
    _sanitize_preview,
    _stored_attachments,
)
from app.core.config import settings
from app.schemas.assistant import ChatAttachment

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PNG_B64 = base64.b64encode(PNG_BYTES).decode("ascii")
PREVIEW = f"data:image/jpeg;base64,{PNG_B64}"


def attachment(**overrides) -> ChatAttachment:
    data = {
        "name": "apunte.png",
        "mime_type": "image/png",
        "data": PNG_B64,
        "preview": PREVIEW,
    }
    data.update(overrides)
    return ChatAttachment(**data)


def test_prepara_png_valido():
    prepared = _prepare_attachments([attachment()])
    assert len(prepared) == 1
    assert prepared[0]["mime_type"] == "image/png"
    assert prepared[0]["data_url"] == f"data:image/png;base64,{PNG_B64}"
    assert prepared[0]["preview"] == PREVIEW


def test_normaliza_jpg_a_jpeg():
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 16
    prepared = _prepare_attachments(
        [attachment(mime_type="image/jpg", data=base64.b64encode(jpeg).decode("ascii"))]
    )
    assert prepared[0]["mime_type"] == "image/jpeg"
    assert prepared[0]["data_url"].startswith("data:image/jpeg;base64,")


def test_rechaza_mime_no_admitido():
    with pytest.raises(HTTPException) as error:
        _prepare_attachments([attachment(mime_type="image/svg+xml")])
    assert error.value.status_code == 400


def test_rechaza_base64_invalido():
    with pytest.raises(HTTPException) as error:
        _prepare_attachments([attachment(data="no es base64!!")])
    assert error.value.status_code == 400


def test_rechaza_contenido_que_no_coincide():
    # Base64 valido, pero el contenido no es un PNG.
    with pytest.raises(HTTPException) as error:
        _prepare_attachments([attachment(data=base64.b64encode(b"hola").decode("ascii"))])
    assert error.value.status_code == 400


def test_rechaza_demasiados_adjuntos(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "ai_max_attachments", 6)
    with pytest.raises(HTTPException) as error:
        _prepare_attachments([attachment() for _ in range(7)])
    assert error.value.status_code == 400


def test_historial_solo_guarda_la_miniatura():
    prepared = _prepare_attachments([attachment(page=1, total_pages=2)])
    stored = _stored_attachments(prepared)
    assert stored[0]["preview"] == PREVIEW
    assert "data_url" not in stored[0]
    assert "data" not in stored[0]
    assert stored[0]["page"] == 1
    assert stored[0]["total_pages"] == 2


@pytest.mark.parametrize(
    "preview",
    [
        "data:image/svg+xml;base64,PHN2Zy8+",
        "data:text/html;base64,PGI+aGk8L2I+",
        "https://ejemplo.com/foto.png",
        f"data:image/png;base64,{'A' * 400_001}",
    ],
)
def test_descarta_miniaturas_no_seguras(preview: str):
    assert _sanitize_preview(preview) is None


def test_conserva_miniatura_raster():
    assert _sanitize_preview(PREVIEW) == PREVIEW
    assert _sanitize_preview(None) is None
