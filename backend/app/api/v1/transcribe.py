"""Transcripcion de clases grabadas (audio) a texto."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.api.deps import CurrentUser
from app.core.logging import get_logger
from app.services import ai_generate

logger = get_logger(__name__)
router = APIRouter(prefix="/transcribe", tags=["transcribe"])

_MAX_BYTES = 24 * 1024 * 1024
_EXTENSIONS = (".mp3", ".m4a", ".wav", ".ogg", ".webm", ".mp4", ".mpeg", ".mpga", ".flac")


@router.post("")
async def transcribe(
    current_user: CurrentUser, file: UploadFile = File(...)
) -> dict[str, str]:
    filename = file.filename or "audio.mp3"
    if not filename.lower().endswith(_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Sube MP3, M4A, WAV, OGG, WEBM o MP4.",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El audio esta vacio.")
    if len(content) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El audio supera los 24 MB. Dividelo en partes mas pequenas.",
        )

    try:
        text = await ai_generate.transcribe_audio(
            current_user, filename, content, file.content_type or "audio/mpeg"
        )
    except ai_generate.AiNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Fallo la transcripcion: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "No se pudo transcribir. La transcripcion usa el endpoint Whisper de OpenAI; "
                "configura OpenAI en Ajustes o un servicio compatible. Detalle: " + str(exc)[:200]
            ),
        ) from exc
    return {"text": text, "filename": filename}
