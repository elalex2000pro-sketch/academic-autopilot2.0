"""Hashing de contrasenas y emision/validacion de JWT."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Devuelve el hash bcrypt de una contrasena en claro."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Comprueba una contrasena contra su hash."""
    try:
        return _pwd_context.verify(plain, hashed)
    except ValueError:
        # Hash malformado en BD: tratamos como no valido.
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    """Genera un JWT firmado con el `sub` = user id."""
    now = datetime.now(tz=timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT. Lanza `jwt.PyJWTError` si es invalido/expirado."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
