"""Configuracion de pytest: variables de entorno para importar la app sin .env."""
import os

# Valores de prueba para que `app.core.config.Settings` pueda instanciarse.
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef0123456789abcdef")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://u:p@localhost:5432/academic_autopilot"
)
os.environ.setdefault(
    "DATABASE_URL_SYNC", "postgresql+psycopg2://u:p@localhost:5432/academic_autopilot"
)
os.environ.setdefault("ENABLE_SCHEDULER", "false")
