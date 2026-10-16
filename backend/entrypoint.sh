#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Preparando carpeta de archivos..."
mkdir -p "${FILES_DIR:-/data/files}"

echo "[entrypoint] Aplicando migraciones de Alembic..."
alembic upgrade head

echo "[entrypoint] Arrancando Uvicorn en el puerto ${BACKEND_PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${BACKEND_PORT:-8000}" \
    --workers "${UVICORN_WORKERS:-1}"
