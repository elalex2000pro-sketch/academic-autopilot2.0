"""Arranque del worker de sincronizacion como proceso independiente.

Alternativa a tener el scheduler embebido en la API. En docker-compose se
levanta como servicio `worker` con `ENABLE_SCHEDULER=true`.
"""
from __future__ import annotations

import asyncio

from app.core.logging import configure_logging, get_logger
from app.workers.scheduler import start_scheduler, stop_scheduler

configure_logging()
logger = get_logger("worker")


async def main() -> None:
    scheduler = start_scheduler()
    if scheduler is None:
        logger.warning("Worker sin scheduler activo (ENABLE_SCHEDULER=false). Saliendo.")
        return
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        stop_scheduler()


if __name__ == "__main__":
    asyncio.run(main())
