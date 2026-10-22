"""Endpoints de integraciones: conexion de Moodle y Google Classroom."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.connectors import ConnectorError, GoogleClassroomConnector, MoodleConnector
from app.core.config import settings
from app.core.crypto import encrypt
from app.db.base import utcnow
from app.models.enums import IntegrationStatus, Provider
from app.models.integration import Integration
from app.schemas.sync import (
    GoogleConnectRequest,
    IntegrationRead,
    MoodleConnectRequest,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationRead])
async def list_integrations(current_user: CurrentUser, db: DbSession) -> list[Integration]:
    result = await db.execute(
        select(Integration).where(Integration.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("/moodle", response_model=IntegrationRead)
async def connect_moodle(
    payload: MoodleConnectRequest, current_user: CurrentUser, db: DbSession
) -> Integration:
    """Valida el token contra la API de Moodle y guarda la integracion."""
    connector = MoodleConnector(base_url=payload.base_url, token=payload.token)
    try:
        site_info = await connector.test_connection()
        # No basta con site_info: comprobamos las funciones que usa el sync.
        courses = await connector.fetch_courses()
        tasks = await connector.fetch_tasks()
    except ConnectorError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo conectar a Moodle: {exc}",
        ) from exc

    site_info.update(
        {
            "courses_visible": len(courses),
            "assignments_visible": len(tasks),
        }
    )

    integration = await _upsert_integration(
        db,
        current_user_id=current_user.id,
        provider=Provider.moodle,
        token=payload.token,
        refresh_token=None,
        expires_at=None,
        base_url=connector.base_url,
        meta=site_info,
    )
    return integration


@router.get("/google/authorize-url")
async def google_authorize_url(current_user: CurrentUser) -> dict:
    """Devuelve la URL de consentimiento OAuth2 de Google."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth no esta configurado en el servidor",
        )
    flow = _build_flow()
    # `state` transporta el id del usuario para asociar el callback.
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=str(current_user.id),
    )
    return {"authorization_url": url}


@router.post("/google", response_model=IntegrationRead)
async def connect_google(
    payload: GoogleConnectRequest, current_user: CurrentUser, db: DbSession
) -> Integration:
    """Intercambia el codigo OAuth2 por tokens y guarda la integracion."""
    flow = _build_flow()
    try:
        flow.fetch_token(code=payload.code)
    except Exception as exc:  # noqa: BLE001 - error de google-auth-oauthlib
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo completar OAuth2: {exc}",
        ) from exc

    credentials = flow.credentials
    if not credentials or not credentials.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Google no devolvio credenciales"
        )

    # Verificacion real contra la API.
    connector = GoogleClassroomConnector(
        access_token=credentials.token,
        refresh_token=credentials.refresh_token,
    )
    try:
        meta = await connector.test_connection()
    except ConnectorError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo acceder a Google Classroom: {exc}",
        ) from exc

    integration = await _upsert_integration(
        db,
        current_user_id=current_user.id,
        provider=Provider.google_classroom,
        token=credentials.token,
        refresh_token=credentials.refresh_token,
        expires_at=credentials.expiry,
        base_url=None,
        meta=meta,
    )
    return integration


@router.get("/google/callback")
async def google_callback(code: str, state: str | None = None) -> dict:
    """Callback de OAuth2. El frontend captura `code` y lo envia a POST /google.

    Se expone para compatibilidad con el flujo de redirect; en la SPA el
    intercambio se hace con `POST /integrations/google`.
    """
    return {"code": code, "state": state, "next": "POST /api/v1/integrations/google"}


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def disconnect(
    integration_id: str, current_user: CurrentUser, db: DbSession
) -> None:
    integration = await db.get(Integration, integration_id)
    if integration is None or integration.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integracion no encontrada")
    integration.status = IntegrationStatus.disabled
    integration.token_enc = None
    integration.refresh_token_enc = None
    await db.commit()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _build_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=settings.google_scopes_list,
        redirect_uri=settings.google_redirect_uri,
    )


async def _upsert_integration(
    db: DbSession,
    *,
    current_user_id,
    provider: Provider,
    token: str | None,
    refresh_token: str | None,
    expires_at,
    base_url: str | None,
    meta: dict,
) -> Integration:
    result = await db.execute(
        select(Integration).where(
            Integration.user_id == current_user_id, Integration.provider == provider
        )
    )
    integration = result.scalar_one_or_none()

    if integration is None:
        integration = Integration(user_id=current_user_id, provider=provider)
        db.add(integration)

    integration.status = IntegrationStatus.connected
    integration.base_url = base_url
    integration.token_enc = encrypt(token)
    if refresh_token:
        integration.refresh_token_enc = encrypt(refresh_token)
    integration.expires_at = expires_at
    integration.meta = meta or {}
    integration.updated_at = utcnow()

    await db.commit()
    await db.refresh(integration)
    return integration
