#!/usr/bin/env bash
# =============================================================================
# Academic Autopilot - Instalador automatico para servidor (Ubuntu/Debian).
#
# Hace TODO en la maquina:
#   1. Instala Docker (si falta)
#   2. Abre los puertos 80/443 en el firewall del sistema
#   3. Configura DuckDNS (dominio gratis) + actualizacion automatica
#   4. Genera el .env de produccion con secretos aleatorios
#   5. (Opcional) Instala Ollama y descarga un modelo para la IA
#   6. Levanta el stack completo con HTTPS automatico (Caddy)
#
# Uso (desde la raiz del proyecto, en el servidor):
#   sudo bash deploy/setup-server.sh <subdominio-duckdns> <token-duckdns> [--no-ai] [--ai-model=llama3.2:3b]
#
# Ejemplo:
#   sudo bash deploy/setup-server.sh miacademia 1a2b3c4d-.... --no-ai
# =============================================================================
set -euo pipefail

SUBDOMAIN="${1:-}"
TOKEN="${2:-}"
DOMAIN="${SUBDOMAIN}.duckdns.org"
SHIFT_N=2
WITH_AI=1
AI_MODEL="llama3.2:3b"

for arg in "$@"; do
  case "$arg" in
    --no-ai) WITH_AI=0 ;;
    --ai-model=*) AI_MODEL="${arg#*=}" ;;
  esac
done

log()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m[!] %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m[ERROR] %s\033[0m\n" "$*"; exit 1; }

# --- Comprobaciones previas ---
[ "$(id -u)" -eq 0 ] || die "Ejecutalo con 'sudo bash deploy/setup-server.sh ...'"
[ -n "$SUBDOMAIN" ] && [ -n "$TOKEN" ] || die "Faltan argumentos. Uso: sudo bash deploy/setup-server.sh <subdominio> <token> [--no-ai]"
[ -f docker-compose.yml ] || die "Ejecutalo desde la raiz del proyecto (no encuentro docker-compose.yml)."

# --- 1. Docker ---
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# --- 2. Firewall del sistema (80/443) ---
log "Abriendo puertos 80 y 443 en el firewall"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp  || true
  ufw allow 443/tcp || true
else
  # Imagenes de Oracle vienen con reglas iptables que solo permiten 22.
  iptables -C INPUT -p tcp --dport 80  -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  iptables -C INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save || true
  command -v iptables-save >/dev/null 2>&1 && mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4 || true
fi

# --- DuckDNS ---
log "Registrando el dominio $DOMAIN en DuckDNS"
resp="$(curl -fsS "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=" || true)"
[ "$resp" = "OK" ] || warn "DuckDNS respondio: '$resp' (revisa el subdominio y el token)"
# Actualizacion automatica cada 5 min (por si cambia la IP)
printf '*/5 * * * * root curl -fsS \"https://www.duckdns.org/update?domains=%s&token=%s&ip=\" >/dev/null 2>&1\n' "$SUBDOMAIN" "$TOKEN" > /etc/cron.d/duckdns
chmod 644 /etc/cron.d/duckdns

# --- .env de produccion ---
if [ -f .env ]; then
  warn "Ya existe .env; se conserva (borralo si quieres regenerarlo)."
else
  log "Generando .env de produccion"
  SECRET="$(openssl rand -hex 32)"
  PGPASS="$(openssl rand -hex 16)"
  cat > .env <<EOF
ENVIRONMENT=production
SECRET_KEY=${SECRET}
ACCESS_TOKEN_EXPIRE_MINUTES=10080

POSTGRES_USER=autopilot
POSTGRES_PASSWORD=${PGPASSWORD}
POSTGRES_DB=academic_autopilot
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://autopilot:${PGPASSWORD}@localhost:5432/academic_autopilot
DATABASE_URL_SYNC=postgresql+psycopg2://autopilot:${PGPASSWORD}@localhost:5432/academic_autopilot

BACKEND_PORT=8000
CORS_ORIGINS=https://${DOMAIN}
CORS_ORIGIN_REGEX=^https://${DOMAIN//./\\.}\$
REALTIME_ENABLED=true
PROXY_PORT=8080
SITE_ADDRESS=${DOMAIN}

SYNC_INTERVAL_MINUTES=30
ENABLE_SCHEDULER=false

MOODLE_TIMEOUT_SECONDS=20

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://${DOMAIN}/settings
GOOGLE_CLASSROOM_SCOPES=https://www.googleapis.com/auth/classroom.courses.readonly,https://www.googleapis.com/auth/classroom.coursework.me.readonly

FILES_DIR=/data/files
MAX_UPLOAD_MB=25
ALLOWED_UPLOAD_EXTENSIONS=pdf,doc,docx,ppt,pptx,xls,xlsx,txt,md,csv,png,jpg,jpeg,gif

AI_ENABLED=$( [ "$WITH_AI" -eq 1 ] && echo true || echo false )
AI_BASE_URL=http://host.docker.internal:11434/v1
AI_API_KEY=
AI_MODEL=${AI_MODEL}
AI_TIMEOUT_SECONDS=120
AI_TEMPERATURE=0.3
AI_STUDIO_MAX_CHARS=12000

NEXT_PUBLIC_API_URL=http://localhost:8000
ENVIRONMENT=production
"
chmod 600 .env
log "Secretos generados y guardados en .env"

# --- IA (Ollama) ---
if [ "$WITH_AI" -eq 1 ]; then
  if ! command -v ollama >/dev/null 2>&1; then
    log "Instalando Ollama"
    curl -fsSL https://ollama.com/install.sh | sh || warn "No se pudo instalar Ollama; la IA usara el modo heuristico"
  fi
  if command -v ollama >/dev/null 2>&1; then
    log "Descargando el modelo $AI_MODEL (puede tardar)"
    ollama pull "$AI_MODEL" || warn "No se pudo descargar el modelo; la IA usara el modo heuristico"
  fi
fi

# --- Arranque ---
log "Construyendo y levantando la aplicacion (unos minutos la primera vez)"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

log "Listo. Abre en tu navegador:  https://${DOMAIN}"
echo   "   (Caddy tarda 1-2 min en emitir el certificado HTTPS la primera vez)"
echo   "   Ver registros:  docker compose logs -f proxy"
