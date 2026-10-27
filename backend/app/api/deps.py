"""Dependencias compartidas de la API (autenticacion y sesion)."""
from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Resuelve el usuario autenticado a partir del JWT Bearer."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales invalidas o ausentes",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(str(payload.get("sub")))
        token_version = int(payload.get("ver", 0) or 0)
    except (jwt.PyJWTError, ValueError, TypeError):
        raise unauthorized from None

    user = await db.get(User, user_id)
    if user is None:
        raise unauthorized
    # Un restablecimiento de contrasena incrementa token_version: los JWT
    # emitidos antes dejan de ser validos inmediatamente.
    if token_version != int(user.token_version or 0):
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
