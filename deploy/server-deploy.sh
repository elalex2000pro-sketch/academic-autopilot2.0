#!/usr/bin/env bash
# Actualiza la app en el servidor: descarga las imagenes publicadas por GitHub
# Actions y recrea los contenedores. Se ejecuta automaticamente en cada
# despliegue (ver .github/workflows/deploy.yml), pero puede lanzarse a mano:
#   ./deploy/server-deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[deploy] Descargando imagenes actualizadas..."
docker compose -f docker-compose.cloud.yml pull

echo "[deploy] Recreando contenedores..."
docker compose -f docker-compose.cloud.yml up -d --remove-orphans

echo "[deploy] Limpiando imagenes antiguas..."
docker image prune -f

echo "[deploy] Estado:"
docker compose -f docker-compose.cloud.yml ps
echo "[deploy] Listo."
