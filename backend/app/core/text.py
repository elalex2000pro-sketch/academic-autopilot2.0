"""Utilidades de texto compartidas por la API.

Algunos clientes y proxies envían el nombre del archivo multipart como bytes
UTF-8 que el parser decodifica como latin-1. El resultado es mojibake:
"DigitalizaciÃ³n Aplicada" en lugar de "Digitalización Aplicada". Estas
funciones reparan ese caso y normalizan el nombre a NFC.
"""
from __future__ import annotations

import unicodedata

_MOJIBAKE_MARKERS = ("Ã", "Â", "â€", "ðŸ", "Ð")


def _looks_like_mojibake(value: str) -> bool:
    return any(marker in value for marker in _MOJIBAKE_MARKERS)


def _repair_mojibake(value: str) -> str:
    if not _looks_like_mojibake(value):
        return value
    try:
        repaired = value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value
    if not repaired:
        return value
    # Solo aceptamos la reparación si reduce las marcas de mojibake.
    before = sum(value.count(marker) for marker in _MOJIBAKE_MARKERS)
    after = sum(repaired.count(marker) for marker in _MOJIBAKE_MARKERS)
    return repaired if after < before else value


def normalize_filename(value: str) -> str:
    """Limpia separadores, repara mojibake y normaliza el nombre a NFC."""
    name = (value or "").strip().replace("\\", "/").rsplit("/", 1)[-1]
    return unicodedata.normalize("NFC", _repair_mojibake(name))
