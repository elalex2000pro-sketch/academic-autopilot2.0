"""Endpoint WebSocket de sincronizacion en tiempo real."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.services.realtime import manager

router = APIRouter(tags=["realtime"])

_KEEPALIVE_SECONDS = 15


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    """Sincroniza la UI de todos los dispositivos ante cualquier cambio de datos."""
    if not settings.realtime_enabled:
        await websocket.close(code=1008)
        return

    # Autenticacion por token (el navegador no envia cabeceras de autorizacion en WS).
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except Exception:  # noqa: BLE001
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
    if user is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    queue = manager.connect(user.id)
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=_KEEPALIVE_SECONDS)
            except TimeoutError:
                await websocket.send_text('{"event":"ping"}')
                continue
            await websocket.send_text(item)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, queue)
