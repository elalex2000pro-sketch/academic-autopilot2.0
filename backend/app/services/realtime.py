"""Gestor de conexiones en tiempo real (WebSocket) por usuario."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import UTC, datetime
from typing import Any


class ConnectionManager:
    """Mantene las conexiones WS activas por usuario y emite eventos de sincronizacion."""

    def __init__(self) -> None:
        self._subs: dict[uuid.UUID, set[asyncio.Queue]] = {}

    def connect(self, user_id: uuid.UUID) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subs.setdefault(user_id, set()).add(queue)
        return queue

    def disconnect(self, user_id: uuid.UUID, queue: asyncio.Queue) -> None:
        subs = self._subs.get(user_id)
        if not subs:
            return
        subs.discard(queue)
        if not subs:
            self._subs.pop(user_id, None)

    def notify(self, user_id: uuid.UUID, event: str, data: Any = None) -> None:
        """Avisa a todos los dispositivos conectados de un cambio de datos."""
        payload = json.dumps(
            {"event": event, "data": data or {}, "at": datetime.now(tz=UTC).isoformat()}
        )
        for queue in list(self._subs.get(user_id, ())):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                pass  # cliente lento; reconectara


manager = ConnectionManager()


def notify(user_id: uuid.UUID, event: str, data: Any = None) -> None:
    manager.notify(user_id, event, data)
