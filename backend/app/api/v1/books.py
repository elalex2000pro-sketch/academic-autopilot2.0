"""Biblioteca de libros completos: importar, leer, preguntar y resumir.

El archivo se sube con el sistema reanudable de `/files/uploads`; despues se
importa aqui. La extraccion se hace en segundo plano para que la subida no
dependa de un timeout HTTP y la interfaz pueda mostrar "Preparando libro...".
"""
from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from sqlalchemy import and_, delete, or_, select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.book import Book, BookMessage, BookSection
from app.models.course import Course
from app.models.document import Document
from app.schemas.book import (
    BookAnswer,
    BookDetail,
    BookImport,
    BookMessageRead,
    BookProgressUpdate,
    BookQuestion,
    BookRead,
    BookSectionMeta,
    BookSectionRead,
    BookSummary,
    BookSummaryRequest,
    BookUpdate,
)
from app.services import book_service
from app.services.realtime import notify

logger = get_logger(__name__)

router = APIRouter(prefix="/books", tags=["books"])

_COVER_COLORS = [
    "#4f46e5",
    "#7c3aed",
    "#0e7490",
    "#047857",
    "#b45309",
    "#be123c",
    "#4338ca",
    "#0f766e",
]


def _cover_color(seed: str) -> str:
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    return _COVER_COLORS[int(digest[:8], 16) % len(_COVER_COLORS)]


def _reading_minutes(total_chars: int) -> int:
    return max(1, round(total_chars / 1200)) if total_chars else 0


def _to_read(book: Book, current_section_title: str | None = None) -> BookRead:
    data = BookRead.model_validate(book)
    data.current_section_title = current_section_title
    data.estimated_minutes = _reading_minutes(book.total_chars)
    return data


async def _get_owned_book(db: DbSession, user_id: uuid.UUID, book_id: uuid.UUID) -> Book:
    book = await db.get(Book, book_id)
    if book is None or book.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Libro no encontrado"
        )
    return book


async def _ensure_owned_course(
    db: DbSession, user_id: uuid.UUID, course_id: uuid.UUID | None
) -> None:
    if course_id is None:
        return
    result = await db.execute(
        select(Course.id).where(Course.id == course_id, Course.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Asignatura no encontrada"
        )


async def _current_titles(
    db: DbSession, books: list[Book]
) -> dict[uuid.UUID, str]:
    if not books:
        return {}
    conditions = [
        and_(
            BookSection.book_id == book.id,
            BookSection.section_index == book.current_section_index,
        )
        for book in books
    ]
    result = await db.execute(
        select(BookSection.book_id, BookSection.section_index, BookSection.title).where(
            or_(*conditions)
        )
    )
    return {row.book_id: row.title for row in result.all()}


# --------------------------------------------------------------------------- #
# Biblioteca
# --------------------------------------------------------------------------- #
@router.get("", response_model=list[BookRead])
async def list_books(current_user: CurrentUser, db: DbSession) -> list[BookRead]:
    result = await db.execute(
        select(Book)
        .where(Book.user_id == current_user.id)
        .order_by(Book.last_opened_at.desc().nullslast(), Book.created_at.desc())
    )
    books = list(result.scalars().all())
    titles = await _current_titles(db, books)
    return [_to_read(book, titles.get(book.id)) for book in books]


@router.post("/import", response_model=BookRead, status_code=status.HTTP_201_CREATED)
async def import_book(
    payload: BookImport,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> BookRead:
    """Convierte un documento ya subido en un libro procesado por secciones."""
    result = await db.execute(
        select(Document).where(
            Document.id == payload.document_id,
            Document.user_id == current_user.id,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado"
        )

    extension = Path(document.filename).suffix.lower().lstrip(".")
    if extension not in book_service.SUPPORTED_BOOK_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Para la biblioteca usa PDF, EPUB, DOCX, TXT o Markdown. "
                "Los formatos MOBI/AZW3 deben convertirse primero a EPUB."
            ),
        )
    if document.size_bytes > settings.max_book_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"El libro supera el límite de {settings.max_book_mb} MB para lectura. "
                "Puedes guardarlo en Archivos, pero no abrirlo en la biblioteca."
            ),
        )

    existing = await db.execute(
        select(Book).where(
            Book.user_id == current_user.id,
            Book.document_id == document.id,
        )
    )
    previous = existing.scalars().first()
    if previous is not None and previous.status in {"processing", "ready"}:
        titles = await _current_titles(db, [previous])
        return _to_read(previous, titles.get(previous.id))

    course_id = payload.course_id if payload.course_id is not None else document.course_id
    await _ensure_owned_course(db, current_user.id, course_id)
    title = (payload.title or "").strip() or book_service._stem(document.filename)
    book = Book(
        user_id=current_user.id,
        course_id=course_id,
        document_id=document.id,
        title=title[:500],
        author=(payload.author or "").strip()[:300] or None,
        format=extension,
        cover_color=_cover_color(title),
        status="processing",
        source_filename=document.filename,
        size_bytes=document.size_bytes,
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    background_tasks.add_task(book_service.process_book, book.id)
    logger.info("Libro en cola: %s (%s)", book.title, current_user.email)
    return _to_read(book)


@router.get("/{book_id}", response_model=BookDetail)
async def get_book(book_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> BookDetail:
    book = await _get_owned_book(db, current_user.id, book_id)
    result = await db.execute(
        select(BookSection)
        .where(BookSection.book_id == book.id)
        .order_by(BookSection.section_index.asc())
    )
    sections = list(result.scalars().all())
    current = next(
        (section.title for section in sections if section.section_index == book.current_section_index),
        sections[0].title if sections else None,
    )
    base = _to_read(book, current)
    return BookDetail(
        **base.model_dump(),
        sections=[BookSectionMeta.model_validate(section) for section in sections],
    )


@router.patch("/{book_id}", response_model=BookRead)
async def update_book(
    book_id: uuid.UUID, payload: BookUpdate, current_user: CurrentUser, db: DbSession
) -> BookRead:
    book = await _get_owned_book(db, current_user.id, book_id)
    data = payload.model_dump(exclude_unset=True)
    if "course_id" in data:
        await _ensure_owned_course(db, current_user.id, data["course_id"])
        book.course_id = data["course_id"]
    if data.get("title") is not None:
        book.title = data["title"].strip()[:500]
    if data.get("author") is not None:
        book.author = data["author"].strip()[:300] or None
    if data.get("cover_color") is not None:
        book.cover_color = data["cover_color"][:20]
    await db.commit()
    await db.refresh(book)
    notify(current_user.id, "books", {"action": "updated", "id": str(book.id)})
    titles = await _current_titles(db, [book])
    return _to_read(book, titles.get(book.id))


@router.post("/{book_id}/reprocess", response_model=BookRead)
async def reprocess_book(
    book_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> BookRead:
    book = await _get_owned_book(db, current_user.id, book_id)
    book.status = "processing"
    book.error_message = None
    await db.commit()
    await db.refresh(book)
    background_tasks.add_task(book_service.process_book, book.id)
    return _to_read(book)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_book(book_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    """Borra el libro y sus secciones; el archivo original sigue en Archivos."""
    book = await _get_owned_book(db, current_user.id, book_id)
    await db.delete(book)
    await db.commit()
    notify(current_user.id, "books", {"action": "deleted", "id": str(book_id)})


# --------------------------------------------------------------------------- #
# Lectura y progreso
# --------------------------------------------------------------------------- #
@router.get("/{book_id}/sections/{section_index}", response_model=BookSectionRead)
async def get_section(
    book_id: uuid.UUID,
    section_index: int,
    current_user: CurrentUser,
    db: DbSession,
) -> BookSection:
    book = await _get_owned_book(db, current_user.id, book_id)
    result = await db.execute(
        select(BookSection).where(
            BookSection.book_id == book.id,
            BookSection.section_index == section_index,
        )
    )
    section = result.scalar_one_or_none()
    if section is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sección no encontrada"
        )
    return section


@router.put("/{book_id}/progress", response_model=BookRead)
async def update_progress(
    book_id: uuid.UUID,
    payload: BookProgressUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> BookRead:
    book = await _get_owned_book(db, current_user.id, book_id)
    if book.total_sections > 0:
        payload.section_index = min(payload.section_index, book.total_sections - 1)
    book.current_section_index = payload.section_index
    if payload.percent is not None:
        book.progress_percent = round(payload.percent, 1)
    elif book.total_sections > 0:
        computed = round(
            min(100.0, ((payload.section_index + 1) / book.total_sections) * 100), 1
        )
        # Volver a abrir un capítulo anterior no debe hacer retroceder el progreso.
        book.progress_percent = max(book.progress_percent, computed)
    book.last_opened_at = utcnow()
    await db.commit()
    await db.refresh(book)
    notify(current_user.id, "books", {"action": "progress", "id": str(book.id)})
    result = await db.execute(
        select(BookSection.title).where(
            BookSection.book_id == book.id,
            BookSection.section_index == book.current_section_index,
        )
    )
    title = result.scalar_one_or_none()
    return _to_read(book, title)


# --------------------------------------------------------------------------- #
# Preguntas con citas, resumen y chat guardado
# --------------------------------------------------------------------------- #
@router.post("/{book_id}/ask", response_model=BookAnswer)
async def ask_book(
    book_id: uuid.UUID,
    payload: BookQuestion,
    current_user: CurrentUser,
    db: DbSession,
) -> BookAnswer:
    book = await _get_owned_book(db, current_user.id, book_id)
    if book.status != "ready" or book.total_sections == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El libro todavía se está preparando. Inténtalo en unos segundos.",
        )
    if not book.text_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este PDF es un escaneo sin capa de texto. Puedes leerlo en el visor, "
            "pero las preguntas y resúmenes necesitan un PDF con OCR.",
        )
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Escribe una pregunta"
        )
    db.add(
        BookMessage(
            book_id=book.id,
            user_id=current_user.id,
            role="user",
            content=question,
            citations=[],
            source="user",
        )
    )
    answer_text, citations, source, notice = await book_service.answer_question(
        db, current_user, book, question, payload.section_index
    )
    assistant = BookMessage(
        book_id=book.id,
        user_id=current_user.id,
        role="assistant",
        content=answer_text,
        citations=[citation.model_dump(mode="json") for citation in citations],
        source=source,
    )
    db.add(assistant)
    book.last_opened_at = utcnow()
    await db.commit()
    await db.refresh(assistant)
    return BookAnswer(
        answer=answer_text,
        citations=citations,
        source=source,  # type: ignore[arg-type]
        notice=notice,
        created_at=assistant.created_at,
    )


@router.get("/{book_id}/messages", response_model=list[BookMessageRead])
async def list_messages(
    book_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(80, ge=1, le=200),
) -> list[BookMessageRead]:
    await _get_owned_book(db, current_user.id, book_id)
    result = await db.execute(
        select(BookMessage)
        .where(BookMessage.book_id == book_id)
        .order_by(BookMessage.created_at.asc())
        .limit(limit)
    )
    return [BookMessageRead.model_validate(message) for message in result.scalars().all()]


@router.delete("/{book_id}/messages", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def clear_messages(
    book_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    await _get_owned_book(db, current_user.id, book_id)
    await db.execute(delete(BookMessage).where(BookMessage.book_id == book_id))
    await db.commit()


@router.post("/{book_id}/summary", response_model=BookSummary)
async def book_summary(
    book_id: uuid.UUID,
    payload: BookSummaryRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> BookSummary:
    book = await _get_owned_book(db, current_user.id, book_id)
    if book.status != "ready" or book.total_sections == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El libro todavía se está preparando. Inténtalo en unos segundos.",
        )
    if not book.text_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este PDF es un escaneo sin capa de texto. Puedes leerlo en el visor, "
            "pero las preguntas y resúmenes necesitan un PDF con OCR.",
        )
    title, summary, key_points, citations, source, notice = await book_service.summarize(
        db, current_user, book, payload.scope, payload.section_index
    )
    return BookSummary(
        title=title,
        summary=summary,
        key_points=key_points,
        citations=citations,
        source=source,  # type: ignore[arg-type]
        notice=notice,
    )
