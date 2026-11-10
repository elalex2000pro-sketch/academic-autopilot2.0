"""Endpoint WebSocket de sincronizacion en tiempo real."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

from anyio import CancelScope
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.chat import ChatMember
from app.models.user import User
from app.services.realtime import manager

router = APIRouter(tags=["realtime"])

_KEEPALIVE_SECONDS = 15


async def _presence_changed(user_id: uuid.UUID, broadcast: bool = True) -> None:
    now = datetime.now(tz=UTC)
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if user is None:
            return
        user.last_seen_at = now
        await session.commit()
        if not broadcast:
            return
        conversations = select(ChatMember.conversation_id).where(ChatMember.user_id == user_id)
        peers = (
            (
                await session.execute(
                    select(ChatMember.user_id)
                    .where(
                        ChatMember.conversation_id.in_(conversations), ChatMember.user_id != user_id
                    )
                    .distinct()
                )
            )
            .scalars()
            .all()
        )
    for peer in peers:
        manager.notify(
            peer,
            "chat",
            {
                "action": "presence",
                "user_id": str(user_id),
                "online": manager.is_online(user_id),
                "last_seen_at": now.isoformat(),
            },
        )


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
        token_version = int(payload.get("ver", 0) or 0)
    except Exception:  # noqa: BLE001
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
    # Igual que en las rutas REST: un reset de contrasena invalida los tokens
    # anteriores tambien para el WebSocket.
    if user is None or token_version != int(user.token_version or 0):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    queue = manager.connect(user.id)
    receiver = None
    queued = None
    try:
        await _presence_changed(user.id)
        receiver = asyncio.create_task(websocket.receive_text())
        queued = asyncio.create_task(queue.get())
        while True:
            done, _ = await asyncio.wait(
                {receiver, queued},
                timeout=_KEEPALIVE_SECONDS,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if not done:
                await websocket.send_text('{"event":"ping"}')
                await _presence_changed(user.id, broadcast=False)
                continue
            if receiver in done:
                receiver.result()  # observes disconnect immediately, not only on next ping
                receiver = asyncio.create_task(websocket.receive_text())
            if queued in done:
                await websocket.send_text(queued.result())
                queued = asyncio.create_task(queue.get())
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, queue)
        for task in (receiver, queued):
            if task is not None:
                task.cancel()
        # ASGI request cancellation must not interrupt presence bookkeeping.
        with CancelScope(shield=True):
            await asyncio.gather(
                *(task for task in (receiver, queued) if task), return_exceptions=True
            )
            if not manager.is_online(user.id):
                await _presence_changed(user.id)
