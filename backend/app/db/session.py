"""Sesion asincrona de SQLAlchemy y fabrica de sesiones."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# `pool_pre_ping` evita conexiones muertas tras reinicios de PostgreSQL.
# `statement_cache_size=0` desactiva las sentencias preparadas del lado servidor:
# necesario para algunos Postgres gestionados (Neon/pgbouncer) que no las admiten.
connect_args: dict = {}
if "asyncpg" in settings.database_url:
    connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia FastAPI: entrega una sesion y garantiza su cierre."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
