"""Endpoints del horario semanal (clases recurrentes)."""
from __future__ import annotations

import os
import re
import uuid
from datetime import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.models.document import Document
from app.models.timetable_entry import TimetableEntry
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
    TimetableImportRequest,
    TimetableImportResult,
)
from app.services import ai_generate, ai_studio_service
from app.services.realtime import notify

logger = get_logger(__name__)
router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("", response_model=list[TimetableEntryRead])
async def list_entries(current_user: CurrentUser, db: DbSession) -> list[TimetableEntry]:
    result = await db.execute(
        select(TimetableEntry)
        .where(TimetableEntry.user_id == current_user.id)
        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_time)
    )
    return list(result.scalars().all())


@router.post("", response_model=TimetableEntryRead, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: TimetableEntryCreate, current_user: CurrentUser, db: DbSession
) -> TimetableEntry:
    entry = TimetableEntry(user_id=current_user.id, **payload.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    notify(current_user.id, "timetable", {"action": "created", "id": str(entry.id)})
    return entry


@router.patch("/{entry_id}", response_model=TimetableEntryRead)
async def update_entry(
    entry_id: uuid.UUID,
    payload: TimetableEntryUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> TimetableEntry:
    entry = await _get_owned_entry(db, current_user.id, entry_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    notify(current_user.id, "timetable", {"action": "updated", "id": str(entry.id)})
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_entry(
    entry_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    entry = await _get_owned_entry(db, current_user.id, entry_id)
    await db.delete(entry)
    await db.commit()
    notify(current_user.id, "timetable", {"action": "deleted", "id": str(entry_id)})


@router.post(
    "/import",
    response_model=TimetableImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_timetable(
    payload: TimetableImportRequest, current_user: CurrentUser, db: DbSession
) -> TimetableImportResult:
    """Importa el horario desde un PDF, Word, Excel, texto o foto con IA."""
    document = await db.get(Document, payload.document_id)
    if document is None or document.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado"
        )

    ext = Path(document.filename).suffix.lower()
    image_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    abs_path = os.path.join(settings.files_dir, document.storage_path)
    if not os.path.exists(abs_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El archivo ya no esta disponible"
        )

    system = (
        "Eres un asistente que convierte horarios escolares en JSON. Devuelve SIEMPRE "
        '{"entries": [{"day_of_week": 0, "start_time": "08:00", "end_time": "10:00", '
        '"title": "Matematicas", "location": "Aula 3"}]}. day_of_week: 0=lunes ... '
        "6=domingo. Usa formato de 24 horas HH:MM. No inventes clases."
    )
    source = "heuristic"
    raw_items: list[dict] = []

    if ext in image_exts:
        mime = document.content_type or "image/jpeg"
        try:
            with open(abs_path, "rb") as handle:
                image_bytes = handle.read()
            data = await ai_generate.generate_json_with_image(
                current_user,
                system,
                "Extrae todas las clases del horario de la foto.",
                image_bytes,
                mime,
                max_tokens=2500,
            )
            raw_items = list(data.get("entries", []))
            source = "image-ai"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Importacion de foto fallida: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "No se pudo leer la foto. Necesitas una IA con vision (OpenAI o Gemini) "
                    "configurada en Ajustes. Detalle: " + str(exc)[:200]
                ),
            ) from exc
    else:
        try:
            text = ai_studio_service.extract_text(document)
        except Exception as exc:  # noqa: BLE001 - archivo corrupto o formato raro
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo leer el archivo: {str(exc)[:200]}",
            ) from exc
        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo no contiene texto legible. Prueba con una foto o un PDF con texto.",
            )
        try:
            data = await ai_generate.generate_json(
                current_user,
                system,
                f"Horario:\n\n{text[:12000]}",
                max_tokens=2500,
                temperature=0.1,
            )
            raw_items = list(data.get("entries", []))
            source = "ai"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Importacion con IA no disponible, uso lector simple: %s", exc)
            raw_items = _heuristic_schedule(text)

    entries = _normalize_entries(raw_items)
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No se detectaron clases. Asegurate de que el archivo tenga lineas como "
                "'Lunes 08:00-10:00 Matematicas Aula 3'."
            ),
        )

    if payload.replace:
        await db.execute(
            delete(TimetableEntry).where(TimetableEntry.user_id == current_user.id)
        )

    created: list[TimetableEntry] = []
    for item in entries:
        entry = TimetableEntry(user_id=current_user.id, **item)
        db.add(entry)
        created.append(entry)
    await db.commit()
    for entry in created:
        await db.refresh(entry)
    notify(current_user.id, "timetable", {"action": "imported", "count": len(created)})
    return TimetableImportResult(
        created=len(created),
        source=source,
        entries=[TimetableEntryRead.model_validate(entry) for entry in created],
    )


_DAY_NAMES = {
    "lunes": 0,
    "martes": 1,
    "miercoles": 2,
    "miércoles": 2,
    "jueves": 3,
    "viernes": 4,
    "sabado": 5,
    "sábado": 5,
    "domingo": 6,
}
_TIME_RE = re.compile(r"(\d{1,2})[:.h](\d{2})")
_RANGE_RE = re.compile(
    r"(?:(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*[:,\-]?\s*)?"
    r"(\d{1,2}[:.h]\d{2})\s*(?:-|–|a|hasta)\s*(\d{1,2}[:.h]\d{2})\s*(.*)",
    re.IGNORECASE,
)


def _parse_time(value: object) -> time | None:
    text = str(value or "").strip().lower().replace(".", ":")
    match = _TIME_RE.search(text)
    if match is None:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return time(hour=hour, minute=minute)


def _parse_day(value: object, fallback: int | None = None) -> int | None:
    if isinstance(value, int) and 0 <= value <= 6:
        return value
    text = str(value or "").strip().lower()
    if text.isdigit() and 0 <= int(text) <= 6:
        return int(text)
    return _DAY_NAMES.get(text, fallback)


def _normalize_entries(raw_items: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen: set[tuple] = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        day = _parse_day(item.get("day_of_week", item.get("day")))
        start = _parse_time(item.get("start_time", item.get("start")))
        end = _parse_time(item.get("end_time", item.get("end")))
        if day is None or start is None or end is None or start >= end:
            continue
        title = str(item.get("title") or item.get("subject") or "").strip()[:300] or None
        location = str(item.get("location") or item.get("room") or "").strip()[:200] or None
        key = (day, start, end, title or "")
        if key in seen:
            continue
        seen.add(key)
        normalized.append(
            {
                "day_of_week": day,
                "start_time": start,
                "end_time": end,
                "title": title,
                "location": location,
            }
        )
    return normalized


def _heuristic_schedule(text: str) -> list[dict]:
    """Lector sencillo por lineas: 'Lunes 08:00-10:00 Matematicas Aula 3'."""
    entries: list[dict] = []
    current_day: int | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        lowered = line.lower().strip(" :-")
        if lowered in _DAY_NAMES:
            current_day = _DAY_NAMES[lowered]
            continue
        match = _RANGE_RE.search(line)
        if match is None:
            continue
        day = _parse_day(match.group(1), current_day)
        start = _parse_time(match.group(2))
        end = _parse_time(match.group(3))
        if day is None or start is None or end is None or start >= end:
            continue
        rest = (match.group(4) or "").strip(" -–|")
        location = None
        location_match = re.search(r"\b(?:en|aula|sal[oó]n)\s+(.+)$", rest, re.IGNORECASE)
        if location_match:
            location = location_match.group(1).strip()[:200]
            rest = rest[: location_match.start()].strip(" -–|")
        entries.append(
            {
                "day_of_week": day,
                "start_time": start,
                "end_time": end,
                "title": rest[:300] or "Clase",
                "location": location,
            }
        )
    return entries


async def _get_owned_entry(
    db: DbSession, user_id: uuid.UUID, entry_id: uuid.UUID
) -> TimetableEntry:
    result = await db.execute(
        select(TimetableEntry).where(
            TimetableEntry.id == entry_id, TimetableEntry.user_id == user_id
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada")
    return entry
