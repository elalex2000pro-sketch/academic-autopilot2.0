"""Configuracion centralizada de la aplicacion (Pydantic Settings).

Todas las variables provienen del entorno (ver `.env.example`). Se validan al
arrancar, por lo que un `.env` incompleto falla rapido y claro.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- General ---
    app_name: str = "Academic Autopilot"
    environment: str = "development"
    debug: bool = False

    # --- Seguridad ---
    secret_key: str = Field(..., min_length=16)
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 dias
    jwt_algorithm: str = "HS256"

    # --- Base de datos ---
    database_url: str = Field(...)
    database_url_sync: str = Field(...)

    # --- API ---
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # --- Worker ---
    enable_scheduler: bool = True
    sync_interval_minutes: int = 30

    # --- Moodle ---
    moodle_timeout_seconds: int = 20

    # --- Google Classroom ---
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/settings"
    google_classroom_scopes: str = (
        "https://www.googleapis.com/auth/classroom.courses.readonly,"
        "https://www.googleapis.com/auth/classroom.coursework.me.readonly"
    )

    # --- Planificador ---
    safety_margin_hours: int = 24
    max_session_minutes: int = 90
    min_session_minutes: int = 30

    # --- Asistente IA (compatible con la API de OpenAI; por defecto Ollama local) ---
    ai_enabled: bool = True
    ai_base_url: str = "http://host.docker.internal:11434/v1"
    ai_api_key: str = ""  # Ollama no requiere clave
    ai_model: str = "llama3.1"
    ai_timeout_seconds: int = 60
    ai_transcribe_model: str = "whisper-1"
    ai_temperature: float = 0.3
    ai_history_limit: int = 12

    # Modelo con vision (para analizar fotos que sube el usuario). Debe estar
    # descargado en Ollama, p.ej. `ollama pull llava` o `ollama pull moondream`.
    ai_vision_model: str = "llava"
    # Tamano maximo de imagen que se envia al modelo de vision (MB).
    ai_max_image_mb: int = 8

    # Control de la app por parte de la IA mediante herramientas (tool calling).
    ai_tools_enabled: bool = True
    ai_max_tool_iterations: int = 6

    # --- Proveedor hibrido: Local, Gemini, ChatGPT, Claude, OpenRouter... ---
    # El usuario elige en Ajustes; aqui se definen los valores de cada preset.
    # Todos los proveedores externos hablan la API compatible con OpenAI.
    ai_default_provider: str = "local"  # local | gemini | openai | claude | openrouter | custom
    # Endpoint compatible con OpenAI de Gemini (para tool calling + vision).
    ai_gemini_base_url: str = (
        "https://generativelanguage.googleapis.com/v1beta/openai/"
    )
    ai_gemini_model: str = "gemini-2.5-flash"
    ai_gemini_vision_model: str = "gemini-2.5-flash"
    # ChatGPT (OpenAI): clave en platform.openai.com -> API keys.
    ai_openai_base_url: str = "https://api.openai.com/v1"
    ai_openai_model: str = "gpt-4o-mini"
    # Claude (Anthropic; usa su capa compatible con OpenAI): console.anthropic.com
    ai_claude_base_url: str = "https://api.anthropic.com/v1"
    ai_claude_model: str = "claude-3-5-haiku-latest"
    # OpenRouter: una sola clave con acceso a casi todos los modelos
    # (GPT, Claude, Gemini, Llama, Mistral...): openrouter.ai/keys
    ai_openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ai_openrouter_model: str = "openai/gpt-4o-mini"

    # --- Almacenamiento de archivos (documentos por asignatura) ---
    files_dir: str = "/data/files"
    # Limite por archivo en MB. 20480 MB = 20 GB. Los archivos grandes se suben
    # por trozos (UPLOAD_CHUNK_MB) y la subida se puede reanudar si se corta.
    max_upload_mb: int = 20480
    # Tamano de cada trozo de subida en MB. 25 MB funciona bien detras de
    # proxys inversos (Caddy, Render, Cloudflare) sin cortar peticiones.
    upload_chunk_mb: int = 25
    # Horas que se conserva una subida a medias antes de limpiarla.
    upload_session_ttl_hours: int = 48
    allowed_upload_extensions: str = "pdf,doc,docx,ppt,pptx,xls,xlsx,txt,md,csv,png,jpg,jpeg,gif"

    # --- IA Studio (resumenes e infografias en PDF) ---
    ai_studio_max_chars: int = 12000

    # --- Tiempo real (WebSocket) ---
    realtime_enabled: bool = True

    # --- CORS ---
    # Regex de origenes permitidos (util para LAN y tuneles). Ej: ^https?://.*$
    cors_origin_regex: str = ""

    @field_validator("environment")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        allowed = {"development", "staging", "production", "test"}
        if v not in allowed:
            raise ValueError(f"environment debe ser uno de {allowed}")
        return v

    @field_validator("ai_default_provider")
    @classmethod
    def _validate_provider(cls, v: str) -> str:
        v = (v or "local").strip().lower()
        if v not in {"local", "gemini"}:
            raise ValueError("AI_DEFAULT_PROVIDER debe ser 'local' o 'gemini'")
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_scopes_list(self) -> list[str]:
        return [s.strip() for s in self.google_classroom_scopes.split(",") if s.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def ai_configured(self) -> bool:
        """La IA esta lista si esta habilitada y tiene base_url + modelo."""
        return bool(self.ai_enabled and self.ai_base_url and self.ai_model)

    @property
    def allowed_extensions(self) -> set[str]:
        return {
            e.strip().lower().lstrip(".")
            for e in self.allowed_upload_extensions.split(",")
            if e.strip()
        }


@lru_cache
def get_settings() -> Settings:
    """Devuelve la instancia unica de Settings (cacheada)."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
