"""Isolated development API for browser verification; never uses production data.

From backend/: python -m uvicorn chat_test_server:app --app-dir tests --port 8000
Requires the optional test dependency aiosqlite. All state lives in a fresh
temporary directory unless AUTOPILOT_TEST_DIR selects an explicit test folder.
"""

from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "chat-test-secret-key-0123456789abcdef0123456789")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql+psycopg2://u:p@localhost/test")
os.environ.setdefault("ENABLE_SCHEDULER", "false")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

import app.models  # noqa: F401 - populate the complete metadata
from app.api.v1 import realtime
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import get_db


@compiles(JSONB, "sqlite")
def _sqlite_jsonb(type_, compiler, **kwargs):
    return "JSON"


def create_test_app(directory: Path) -> FastAPI:
    directory.mkdir(parents=True, exist_ok=True)
    engine = create_async_engine("sqlite+aiosqlite:///" + (directory / "chat.sqlite").as_posix())

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def test_session():
        async with sessions() as session:
            yield session

    @asynccontextmanager
    async def lifespan(application):
        previous_factory = realtime.AsyncSessionLocal
        previous_files = settings.files_dir
        settings.files_dir = str(directory / "files")
        realtime.AsyncSessionLocal = sessions
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            yield
        finally:
            realtime.AsyncSessionLocal = previous_factory
            settings.files_dir = previous_files
            await engine.dispose()

    application = FastAPI(lifespan=lifespan)
    application.state.limiter = limiter
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.dependency_overrides[get_db] = test_session
    application.include_router(api_router)

    @application.get("/health")
    async def health():
        return {"status": "ok", "environment": "isolated-chat-test"}

    return application


app = create_test_app(
    Path(os.environ.get("AUTOPILOT_TEST_DIR") or tempfile.mkdtemp(prefix="autopilot-chat-"))
)
