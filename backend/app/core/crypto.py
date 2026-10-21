"""Cifrado simetrico (Fernet) para los tokens de integracion.

Los access/refresh tokens de Moodle y Google nunca se guardan en claro: se
cifran con una clave derivada de `SECRET_KEY` mediante SHA-256 (32 bytes).
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _build_fernet() -> Fernet:
    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


_fernet = _build_fernet()


def encrypt(plaintext: str | None) -> str | None:
    """Cifra un texto. Devuelve None si la entrada es None/vacia."""
    if not plaintext:
        return None
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str | None) -> str | None:
    """Descifra un texto. Devuelve None si la entrada es None o invalida."""
    if not ciphertext:
        return None
    try:
        return _fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
