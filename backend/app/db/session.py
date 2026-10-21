"""Sesion asincrona de SQLAlchemy y fabrica de sesiones."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Modos SSL que entiende asyncpg (los de PostgreSQL usan `sslmode`).
_ASYNC_PG_SSL_MODES = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}


def normalize_async_database_url(url: str) -> str:
    """Adapta la URL de PostgreSQL al formato que entiende asyncpg.

    Proveedores como Neon entregan la cadena con parametros pensados para
    psycopg (`sslmode=require`, `channel_binding=require`...) que asyncpg no
    acepta: lanzan "TypeError: connect() got an unexpected keyword argument
    'sslmode'" y todas las consultas fallan con error 500. Aqui se traducen
    (`sslmode` -> `ssl`) y se descartan los que no aplican.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    sslmode = query.pop("sslmode", None)
    for incompatible in ("channel_binding", "sslrootcert", "sslcert", "sslkey"):
        query.pop(incompatible, None)
    if sslmode and "ssl" not in query:
        query["ssl"] = sslmode if sslmode in _ASYNC_PG_SSL_MODES else "require"
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )


# `pool_pre_ping` evita conexiones muertas tras reinicios de PostgreSQL.
# `statement_cache_size=0` mantiene la conexion compatible con el pooler de
# Neon (pgbouncer en modo transaccion), que no soporta sentencias preparadas.
engine = create_async_engine(
    normalize_async_database_url(settings.database_url),
    echo=settings.debug,
    pool_pre_ping=True,
    future=True,
    connect_args={"statement_cache_size": 0},
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
