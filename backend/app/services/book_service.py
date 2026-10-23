"""Extraccion y estudio de libros completos.

- Extrae el texto completo por capitulos/secciones (PDF, EPUB, DOCX, TXT, MD).
- Recupera los pasajes relevantes para responder con citas verificables.
- Si hay un modelo de IA configurado, redacta; si no, responde extrayendo
  literalmente fragmentos del libro (nunca inventa contenido).
"""
from __future__ import annotations

import asyncio
import html
import json
import posixpath
import re
import unicodedata
import uuid
import zipfile
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.models.book import Book, BookSection
from app.models.document import Document
from app.models.user import User
from app.schemas.book import BookCitation
from app.services.ai_service import resolve_profile
from app.services.realtime import notify

logger = get_logger(__name__)

MAX_SECTION_CHARS = 14_000
MIN_SECTION_CHARS = 60
SUPPORTED_BOOK_EXTENSIONS = {"pdf", "epub", "docx", "txt", "md"}

_SPANISH_STOPWORDS = {
    "que", "del", "las", "los", "una", "uno", "unos", "unas", "por", "para", "con",
    "sin", "sobre", "como", "mas", "pero", "sus", "este", "esta", "estos", "estas",
    "ese", "esa", "esos", "esas", "hay", "fue", "son", "ser", "estar",
    "cual", "cuales", "cuando", "donde", "porque", "entre", "desde",
    "hasta", "todo", "toda", "todos", "todas", "hace", "hacia", "muy",
    "según", "segun", "libro", "capítulo", "capitulo", "texto", "autor", "obra",
}

try:
    from docx import Document as DocxDocument
except Exception:  # pragma: no cover
    DocxDocument = None


@dataclass
class ExtractedSection:
    title: str
    content: str
    page_start: int | None = None
    page_end: int | None = None


@dataclass
class ExtractedBook:
    title: str
    author: str | None = None
    sections: list[ExtractedSection] = field(default_factory=list)
    # False cuando el PDF es un escaneo sin capa de texto. El visor dibuja las
    # paginas originales en canvas y desactiva las herramientas de lectura.
    text_available: bool = True


# --------------------------------------------------------------------------- #
# Limpieza y utilidades
# --------------------------------------------------------------------------- #
def _clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _stem(filename: str) -> str:
    return re.sub(r"[_-]+", " ", Path(filename).stem).strip() or "Libro"


def _split_long_text(text: str, limit: int = MAX_SECTION_CHARS) -> list[str]:
    """Divide un texto muy largo por parrafos y, si hace falta, por frases."""
    text = _clean_text(text)
    if len(text) <= limit:
        return [text] if text else []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > limit:
            if current:
                chunks.append(current.strip())
                current = ""
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            piece = ""
            for sentence in sentences:
                if len(piece) + len(sentence) + 1 > limit and piece:
                    chunks.append(piece.strip())
                    piece = ""
                piece += sentence + " "
            if piece.strip():
                chunks.append(piece.strip())
        elif len(current) + len(paragraph) + 2 > limit and current:
            chunks.append(current.strip())
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}".strip() if current else paragraph
    if current.strip():
        chunks.append(current.strip())
    return chunks


def _pack_pages(
    pages: list[tuple[int, str]],
    chapter_title: str | None,
    max_chars: int = MAX_SECTION_CHARS,
) -> list[ExtractedSection]:
    """Agrupa paginas consecutivas en secciones legibles."""
    sections: list[ExtractedSection] = []
    buffer: list[str] = []
    start_page: int | None = None
    end_page: int | None = None

    def flush() -> None:
        nonlocal buffer, start_page, end_page
        content = _clean_text("\n\n".join(buffer))
        if content:
            if chapter_title:
                base_title = chapter_title
            elif start_page == end_page:
                base_title = f"Página {start_page}"
            else:
                base_title = f"Páginas {start_page}–{end_page}"
            parts = _split_long_text(content, max_chars)
            for part_index, part in enumerate(parts, start=1):
                if not part:
                    continue
                title = base_title
                if len(parts) > 1:
                    title = f"{base_title} · parte {part_index}"
                sections.append(
                    ExtractedSection(
                        title=title,
                        content=part,
                        page_start=start_page,
                        page_end=end_page,
                    )
                )
        buffer = []
        start_page = None
        end_page = None

    for page_number, page_text in pages:
        text = _clean_text(page_text)
        if not text:
            continue
        current_len = sum(len(x) + 2 for x in buffer)
        if buffer and current_len + len(text) > max_chars:
            flush()
        if start_page is None:
            start_page = page_number
        end_page = page_number
        buffer.append(text)
    flush()

    # Ajusta el titulo de las partes para que no quede "parte 1" en un capitulo
    # que solo ocupa una seccion.
    if chapter_title and len(sections) == 1 and " · parte " in sections[0].title:
        sections[0].title = chapter_title
    return sections


def _pdf_outline(reader: PdfReader) -> list[tuple[int, str]]:
    """Devuelve (pagina 0-based, titulo) de los marcadores del PDF."""
    starts: list[tuple[int, str]] = []

    def walk(items: Any, depth: int = 0) -> None:
        if depth > 4:
            return
        for item in items or []:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                page = reader.get_destination_page_number(item)
                title = str(getattr(item, "title", "") or "").strip()
            except Exception:
                continue
            if title and 0 <= page < len(reader.pages):
                starts.append((page, title[:180]))

    try:
        walk(reader.outline)
    except Exception:
        return []
    # Deduplica y ordena; conserva el primer titulo de cada pagina.
    result: list[tuple[int, str]] = []
    seen: set[int] = set()
    for page, title in sorted(starts, key=lambda x: x[0]):
        if page in seen:
            continue
        seen.add(page)
        result.append((page, title))
    return result


def _extract_pdf(path: str, fallback_title: str) -> ExtractedBook:
    try:
        reader = PdfReader(path)
    except Exception as exc:
        raise ValueError("No se pudo abrir el PDF. Comprueba que no esté dañado.") from exc

    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ValueError(
                "El PDF está protegido con contraseña. Quita la protección y vuelve a subirlo."
            ) from exc

    metadata = reader.metadata or {}
    title = str(metadata.get("/Title") or "").strip() or fallback_title
    author = str(metadata.get("/Author") or "").strip() or None

    pages: list[tuple[int, str]] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        pages.append((index, text))

    if sum(len(text.strip()) for _, text in pages) < 80:
        # PDF escaneado: no hay capa de texto. Guardamos una seccion por pagina
        # para conservar el indice y el progreso; el frontend dibuja el archivo
        # original con pdf.js en lugar de intentar mostrar texto inexistente.
        fallback_sections = [
            ExtractedSection(
                title=f"Página {number}",
                content=f"[Página escaneada {number}]",
                page_start=number,
                page_end=number,
            )
            for number, _ in pages[: settings.book_max_sections]
        ]
        if not fallback_sections:
            raise ValueError("El PDF no contiene páginas legibles.")
        return ExtractedBook(
            title=title[:500],
            author=author,
            sections=fallback_sections,
            text_available=False,
        )

    sections: list[ExtractedSection] = []
    outline = _pdf_outline(reader)
    if outline:
        first_page = outline[0][0] + 1
        if first_page > 1:
            front_pages = [(n, t) for n, t in pages if n < first_page]
            sections.extend(_pack_pages(front_pages, "Inicio"))
        for i, (start, chapter) in enumerate(outline):
            start_page = start + 1
            end_page = (outline[i + 1][0]) if i + 1 < len(outline) else len(pages)
            chapter_pages = [(n, t) for n, t in pages if start_page <= n <= end_page]
            sections.extend(_pack_pages(chapter_pages, chapter))
    else:
        sections = _pack_pages(pages, None)

    sections = [s for s in sections if s.content.strip()]
    if not sections:
        raise ValueError("No se pudo extraer texto útil del PDF.")
    return ExtractedBook(title=title[:500], author=author, sections=sections)


class _HtmlTextParser(HTMLParser):
    """Extrae texto y titulos de un XHTML sin dependencias externas."""

    _BLOCK = {"p", "div", "section", "article", "li", "br", "tr", "blockquote", "pre"}
    _HEADINGS = {"h1", "h2", "h3"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.headings: list[str] = []
        self._heading_depth = 0
        self._heading_text: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "head", "nav"}:
            self._skip += 1
            return
        if tag in self._BLOCK or tag in self._HEADINGS:
            self.parts.append("\n")
        if tag in self._HEADINGS:
            self._heading_depth += 1
            self._heading_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "head", "nav"}:
            self._skip = max(0, self._skip - 1)
            return
        if tag in self._HEADINGS and self._heading_depth:
            text = " ".join("".join(self._heading_text).split())
            if text:
                self.headings.append(text[:200])
            self._heading_depth -= 1
        if tag in self._BLOCK or tag in self._HEADINGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        if self._heading_depth:
            self._heading_text.append(data)
        self.parts.append(data)

    def text(self) -> str:
        return _clean_text(html.unescape("".join(self.parts)))


def _epub_metadata(root: ET.Element, namespace: dict[str, str]) -> tuple[str | None, str | None]:
    title = root.findtext(".//dc:title", default="", namespaces=namespace).strip() or None
    author = root.findtext(".//dc:creator", default="", namespaces=namespace).strip() or None
    return title, author


def _extract_epub(path: str, fallback_title: str) -> ExtractedBook:
    try:
        archive = zipfile.ZipFile(path)
    except Exception as exc:
        raise ValueError("No se pudo abrir el EPUB. Comprueba que no esté dañado.") from exc

    with archive:
        try:
            container = ET.fromstring(archive.read("META-INF/container.xml"))
            # El elemento rootfile vive en el namespace OCF; buscar por nombre
            # local evita depender del prefijo o del namespace exacto.
            rootfile = next(
                (
                    element
                    for element in container.iter()
                    if element.tag.rsplit("}", 1)[-1] == "rootfile"
                ),
                None,
            )
            opf_path = rootfile.attrib.get("full-path") if rootfile is not None else None
            if not opf_path:
                raise ValueError("EPUB sin archivo de contenido")
            opf = ET.fromstring(archive.read(opf_path))
        except KeyError as exc:
            raise ValueError("El EPUB está incompleto o protegido con DRM.") from exc
        except ET.ParseError as exc:
            raise ValueError("El EPUB tiene un formato inválido.") from exc

        ns = {
            "dc": "http://purl.org/dc/elements/1.1/",
            "opf": "http://www.idpf.org/2007/opf",
        }
        title, author = _epub_metadata(opf, ns)
        title = title or fallback_title
        base_dir = posixpath.dirname(opf_path)

        manifest: dict[str, str] = {}
        for item in opf.findall(".//opf:manifest/opf:item", ns):
            item_id = item.attrib.get("id")
            href = item.attrib.get("href")
            media_type = item.attrib.get("media-type", "")
            if item_id and href and ("html" in media_type or href.lower().endswith((".xhtml", ".html", ".htm"))):
                manifest[item_id] = posixpath.normpath(posixpath.join(base_dir, href))

        spine: list[str] = []
        for itemref in opf.findall(".//opf:spine/opf:itemref", ns):
            item_id = itemref.attrib.get("idref")
            if item_id in manifest:
                spine.append(manifest[item_id])
        if not spine:
            spine = sorted(
                name for name in archive.namelist()
                if name.lower().endswith((".xhtml", ".html", ".htm"))
            )

        sections: list[ExtractedSection] = []
        for position, href in enumerate(spine, start=1):
            try:
                raw = archive.read(href)
            except KeyError:
                continue
            try:
                parser = _HtmlTextParser()
                parser.feed(raw.decode("utf-8", errors="replace"))
                content = parser.text()
            except Exception:
                continue
            if len(content) < MIN_SECTION_CHARS:
                continue
            heading = parser.headings[0] if parser.headings else f"Sección {position}"
            for part in _split_long_text(content):
                if not part:
                    continue
                part_title = heading if len(sections) == 0 or " · parte " not in part else heading
                sections.append(ExtractedSection(title=part_title[:300], content=part))

    if not sections:
        raise ValueError(
            "No se pudo extraer texto del EPUB. Puede estar protegido con DRM o contener solo imágenes."
        )
    return ExtractedBook(title=title[:500], author=author, sections=sections)


def _extract_docx(path: str, fallback_title: str) -> ExtractedBook:
    if DocxDocument is None:
        raise ValueError("El soporte para DOCX no está disponible en el servidor.")
    try:
        doc = DocxDocument(path)
    except Exception as exc:
        raise ValueError("No se pudo leer el DOCX. Comprueba que no esté dañado.") from exc

    title = (doc.core_properties.title or "").strip() or fallback_title
    author = (doc.core_properties.author or "").strip() or None
    sections: list[ExtractedSection] = []
    heading = "Inicio"
    paragraphs: list[str] = []

    def flush() -> None:
        nonlocal paragraphs
        text = _clean_text("\n\n".join(paragraphs))
        if text:
            for part in _split_long_text(text):
                if part:
                    sections.append(ExtractedSection(title=heading[:300], content=part))
        paragraphs = []

    for paragraph in doc.paragraphs:
        style = (paragraph.style.name if paragraph.style else "") or ""
        text = (paragraph.text or "").strip()
        if not text:
            continue
        if style.lower().startswith(("heading", "título", "titulo")) or (
            len(text) < 120 and text.isupper()
        ):
            flush()
            heading = text
            continue
        paragraphs.append(text)
    flush()

    if not sections:
        raise ValueError("El DOCX no contiene texto legible.")
    return ExtractedBook(title=title[:500], author=author, sections=sections)


def _extract_text_file(path: str, fallback_title: str, markdown: bool) -> ExtractedBook:
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            raw = handle.read()
    except OSError as exc:
        raise ValueError("No se pudo leer el archivo de texto.") from exc
    raw = _clean_text(raw)
    if not raw:
        raise ValueError("El archivo de texto está vacío.")

    title = fallback_title
    if markdown:
        match = re.search(r"^\s*#\s+(.+)$", raw, flags=re.MULTILINE)
        if match:
            title = match.group(1).strip()[:500]

    headings = list(re.finditer(r"^\s*#{1,3}\s+(.+)$", raw, flags=re.MULTILINE)) if markdown else []
    sections: list[ExtractedSection] = []
    if headings:
        for index, match in enumerate(headings):
            start = match.end()
            end = headings[index + 1].start() if index + 1 < len(headings) else len(raw)
            content = _clean_text(raw[start:end])
            if content:
                for part in _split_long_text(content):
                    if part:
                        sections.append(ExtractedSection(title=match.group(1).strip()[:300], content=part))
    else:
        for number, part in enumerate(_split_long_text(raw), start=1):
            if part:
                sections.append(ExtractedSection(title=f"Parte {number}", content=part))

    return ExtractedBook(title=title, author=None, sections=sections)


def extract_book(path: str, filename: str) -> ExtractedBook:
    """Extrae el libro completo. Es una funcion sincrona: se ejecuta en un hilo."""
    extension = Path(filename).suffix.lower().lstrip(".")
    fallback_title = _stem(filename)
    if extension == "pdf":
        book = _extract_pdf(path, fallback_title)
    elif extension == "epub":
        book = _extract_epub(path, fallback_title)
    elif extension == "docx":
        book = _extract_docx(path, fallback_title)
    elif extension in {"txt", "md"}:
        book = _extract_text_file(path, fallback_title, markdown=extension == "md")
    else:
        raise ValueError(
            "Formato de libro no soportado. Usa PDF, EPUB, DOCX, TXT o Markdown."
        )

    if not book.sections:
        raise ValueError("No se encontró texto legible en el libro.")
    if book.text_available and sum(
        len(section.content) for section in book.sections
    ) > settings.book_max_chars:
        raise ValueError(
            "El libro supera el límite de texto de la biblioteca "
            f"({settings.book_max_chars:,} caracteres). Divide el archivo en volúmenes."
        )
    if len(book.sections) > settings.book_max_sections:
        raise ValueError(
            f"El libro tiene demasiadas secciones (máximo {settings.book_max_sections})."
        )
    return book


# --------------------------------------------------------------------------- #
# Procesamiento en segundo plano
# --------------------------------------------------------------------------- #
async def process_book(book_id: uuid.UUID) -> None:
    """Extrae el texto y guarda todas las secciones. Se ejecuta en segundo plano."""
    async with AsyncSessionLocal() as db:
        book = await db.get(Book, book_id)
        if book is None:
            return
        document = await db.get(Document, book.document_id) if book.document_id else None
        try:
            if document is None:
                raise ValueError("El archivo original ya no está disponible. Vuelve a subir el libro.")
            path = Path(settings.files_dir) / document.storage_path
            if not path.exists():
                raise ValueError(
                    "El archivo original ya no está en el servidor (puede haber ocurrido un "
                    "redespliegue). Vuelve a subirlo."
                )
            extracted = await asyncio.to_thread(extract_book, str(path), document.filename)
            await db.execute(delete(BookSection).where(BookSection.book_id == book.id))
            for index, section in enumerate(extracted.sections):
                content = section.content.strip()
                if not content:
                    continue
                db.add(
                    BookSection(
                        book_id=book.id,
                        section_index=index,
                        title=section.title[:500] or f"Sección {index + 1}",
                        content=content,
                        char_count=len(content),
                        page_start=section.page_start,
                        page_end=section.page_end,
                    )
                )
            stem = _stem(document.filename)
            if book.title.strip() in {"", stem} and extracted.title:
                book.title = extracted.title[:500]
            if not book.author and extracted.author:
                book.author = extracted.author[:300]
            book.format = Path(document.filename).suffix.lower().lstrip(".") or "txt"
            book.total_sections = len(extracted.sections)
            book.total_chars = (
                sum(len(section.content) for section in extracted.sections)
                if extracted.text_available
                else 0
            )
            book.text_available = extracted.text_available
            book.current_section_index = 0
            book.progress_percent = 0.0
            book.status = "ready"
            book.error_message = None
            await db.commit()
            logger.info(
                "Libro procesado: %s (%d secciones, %d caracteres)",
                book.title,
                book.total_sections,
                book.total_chars,
            )
            notify(book.user_id, "books", {"action": "ready", "id": str(book.id)})
        except Exception as exc:  # noqa: BLE001 - se informa al usuario
            logger.warning("No se pudo procesar el libro %s: %s", book_id, exc)
            await db.rollback()
            book = await db.get(Book, book_id)
            if book is not None:
                book.status = "error"
                book.error_message = str(exc)[:2000]
                await db.commit()
                notify(book.user_id, "books", {"action": "error", "id": str(book.id)})


# --------------------------------------------------------------------------- #
# Busqueda, citas y respuestas
# --------------------------------------------------------------------------- #
def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in text if not unicodedata.combining(char))


def _terms(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9áéíóúüñ]{3,}", _normalize(text))
    return [word for word in words if word not in _SPANISH_STOPWORDS]


def _quote(section: BookSection, query: str, max_length: int = 320) -> str:
    content = re.sub(r"\s+", " ", section.content)
    terms = _terms(query)
    position = -1
    for term in terms:
        position = _normalize(content).find(term)
        if position >= 0:
            break
    if position < 0:
        return content[:max_length].strip() + ("…" if len(content) > max_length else "")
    start = max(0, position - 110)
    end = min(len(content), position + max_length)
    snippet = content[start:end].strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(content):
        snippet += "…"
    return snippet


def _citation(section: BookSection, query: str) -> BookCitation:
    return BookCitation(
        section_id=section.id,
        section_index=section.section_index,
        title=section.title,
        quote=_quote(section, query),
        page_start=section.page_start,
        page_end=section.page_end,
    )


async def _rank_sections(
    db: AsyncSession,
    book: Book,
    query: str,
    current_index: int | None,
    limit: int = 5,
) -> list[BookSection]:
    result = await db.execute(
        select(BookSection)
        .where(BookSection.book_id == book.id)
        .order_by(BookSection.section_index.asc())
    )
    sections = list(result.scalars().all())
    if not sections:
        return []
    terms = _terms(query)
    phrase = _normalize(query).strip()
    scored: list[tuple[float, BookSection]] = []
    for section in sections:
        haystack = _normalize(f"{section.title}\n{section.content}")
        score = 0.0
        for term in terms:
            count = haystack.count(term)
            if count:
                score += min(count, 12)
                if term in _normalize(section.title):
                    score += 10
        if len(phrase) > 8 and phrase in haystack:
            score += 30
        if current_index is not None and section.section_index == current_index:
            score += 2.5
        if score > 0:
            scored.append((score, section))

    intent = _normalize(query)
    summary_intent = any(
        word in intent
        for word in ("resumen", "resume", "ideas principales", "de que trata", "de qué trata", "capitulo", "capítulo")
    )
    if summary_intent and current_index is not None:
        for score, section in scored:
            if section.section_index == current_index:
                scored.remove((score, section))
                scored.insert(0, (score + 50, section))
                break
        else:
            current = next((s for s in sections if s.section_index == current_index), None)
            if current is not None:
                scored.insert(0, (50.0, current))

    if not scored:
        # Sin coincidencias: usa la seccion actual o el comienzo del libro para
        # no devolver una respuesta vacia.
        if current_index is not None:
            fallback = [s for s in sections if s.section_index == current_index]
        else:
            fallback = []
        scored = [(1.0, section) for section in (fallback or sections[:min(3, len(sections))])]

    scored.sort(key=lambda item: (-item[0], item[1].section_index))
    return [section for _, section in scored[:limit]]


def _excerpts(sections: list[BookSection], query: str) -> str:
    blocks: list[str] = []
    budget = 18_000
    for index, section in enumerate(sections, start=1):
        content = section.content
        if len(content) > 4200:
            content = _quote(section, query, max_length=4200)
        block = (
            f"[S{index}] {section.title}"
            + (f" (páginas {section.page_start}-{section.page_end})" if section.page_start else "")
            + f"\n{content}"
        )
        if budget - len(block) < 0:
            break
        budget -= len(block)
        blocks.append(block)
    return "\n\n".join(blocks)


def _split_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())
    return [s.strip() for s in sentences if len(s.strip()) >= 35]


def _extractive_answer(question: str, sections: list[BookSection]) -> tuple[str, list[BookCitation]]:
    terms = _terms(question)
    selected: list[str] = []
    citations: list[BookCitation] = []
    for index, section in enumerate(sections[:3], start=1):
        sentences = _split_sentences(section.content)
        relevant = [s for s in sentences if any(term in _normalize(s) for term in terms)]
        for sentence in (relevant or sentences)[:2]:
            if sentence not in selected:
                selected.append(f"{sentence} [S{index}]")
        citations.append(_citation(section, question))
    if not selected:
        return (
            "No encontré un pasaje claro para responder a esa pregunta en este libro.",
            citations,
        )
    return "\n\n".join(selected), citations


async def _call_llm(user: User, system: str, prompt: str) -> str | None:
    profile = resolve_profile(user)
    if not profile.configured:
        return None
    payload = {
        "model": profile.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.15,
        "stream": False,
    }
    headers = {"Content-Type": "application/json"}
    if profile.api_key:
        headers["Authorization"] = f"Bearer {profile.api_key}"
    try:
        async with httpx.AsyncClient(timeout=min(profile.timeout_seconds, 90)) as client:
            response = await client.post(
                profile.base_url.rstrip("/") + "/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
        content = ((data.get("choices") or [{}])[0].get("message", {}) or {}).get("content") or ""
        return content.strip() or None
    except Exception as exc:  # noqa: BLE001 - se degrada a extractivo
        logger.warning("IA del libro no disponible (%s); usando extractivo", exc)
        return None


def _parse_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(cleaned[start : end + 1])
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


async def answer_question(
    db: AsyncSession,
    user: User,
    book: Book,
    question: str,
    section_index: int | None = None,
) -> tuple[str, list[BookCitation], str, str | None]:
    actual_index = section_index if section_index is not None else book.current_section_index
    sections = await _rank_sections(db, book, question, actual_index)
    if not sections:
        return (
            "Este libro todavía no tiene secciones legibles.",
            [],
            "extractive",
            None,
        )
    citations = [_citation(section, question) for section in sections]
    excerpts = _excerpts(sections, question)

    system = (
        "Eres un tutor académico que responde EXCLUSIVAMENTE con la información de los "
        "extractos proporcionados de un libro. No uses conocimiento externo ni inventes. "
        "Si la respuesta no está en los extractos, dilo claramente. Responde en español, "
        "con claridad y brevedad (máximo 250 palabras). Cada afirmación debe llevar una "
        "cita como [S1], [S2], etc. No cites fuentes que no existan."
    )
    prompt = (
        f"LIBRO: {book.title}\n"
        + (f"AUTOR: {book.author}\n" if book.author else "")
        + f"\nEXTRACTOS:\n{excerpts}\n\n"
        + f"PREGUNTA: {question}\n\n"
        + "Responde solo con lo que dicen los extractos y añade las citas [S#]."
    )
    answer = await _call_llm(user, system, prompt)
    if answer:
        return answer, citations, "ai", None

    answer, citations = _extractive_answer(question, sections)
    notice = (
        "No hay un modelo de IA conectado. Esta respuesta se ha extraído literalmente "
        "del libro; no se ha inventado nada."
    )
    return answer, citations, "extractive", notice


async def summarize(
    db: AsyncSession,
    user: User,
    book: Book,
    scope: str,
    section_index: int | None = None,
) -> tuple[str, str, list[str], list[BookCitation], str, str | None]:
    index = section_index if section_index is not None else book.current_section_index
    if scope == "current":
        result = await db.execute(
            select(BookSection).where(
                BookSection.book_id == book.id, BookSection.section_index == index
            )
        )
        section = result.scalar_one_or_none()
        if section is None:
            result = await db.execute(
                select(BookSection)
                .where(BookSection.book_id == book.id)
                .order_by(BookSection.section_index.asc())
                .limit(1)
            )
            section = result.scalar_one_or_none()
        if section is None:
            raise ValueError("El libro no tiene secciones legibles.")
        title = f"Resumen · {section.title}"
        content = section.content[:16_000]
        citations = [_citation(section, title)]
        source_sections = [section]
    else:
        result = await db.execute(
            select(BookSection)
            .where(BookSection.book_id == book.id)
            .order_by(BookSection.section_index.asc())
        )
        all_sections = list(result.scalars().all())
        if not all_sections:
            raise ValueError("El libro no tiene secciones legibles.")
        source_sections = all_sections[:8]
        if len(all_sections) > 8:
            source_sections += all_sections[-4:]
        title = f"Resumen exprés · {book.title}"
        sampled: list[str] = []
        for position, item in enumerate(source_sections, start=1):
            sampled.append(f"[S{position}] {item.title}\n{item.content[:1800]}")
        content = "\n\n".join(sampled)[:24_000]
        citations = [_citation(item, item.title) for item in source_sections[:5]]

    system = (
        "Eres un tutor académico que resume libros en español sin inventar. Usa solo el "
        "contenido proporcionado. Devuelve SIEMPRE un JSON válido con este esquema: "
        '{"summary": "resumen claro de 3-5 frases", "key_points": ["idea 1", "idea 2", '
        '"idea 3"]}. Las ideas deben ser concretas y útiles para estudiar.'
    )
    prompt = (
        f"LIBRO: {book.title}\n"
        + (f"AUTOR: {book.author}\n" if book.author else "")
        + f"\nCONTENIDO:\n{content}\n\n"
        + "Genera el resumen y entre 3 y 6 ideas clave."
    )
    raw = await _call_llm(user, system, prompt)
    data = _parse_json(raw) if raw else None
    if data and isinstance(data.get("summary"), str):
        summary_text = data["summary"].strip()
        points = [str(point).strip() for point in (data.get("key_points") or []) if str(point).strip()]
        if summary_text:
            return title, summary_text, points[:8], citations, "ai", None

    if scope == "current":
        sentences = _split_sentences(content)
        summary_text = " ".join(sentences[:4]) or content[:700]
        points = sentences[:5]
    else:
        summary_text = (
            f"{book.title} se organiza en {book.total_sections} secciones. "
            f"Este resumen exprés recorre las secciones principales para darte una visión general."
        )
        points = []
        for section in source_sections[:7]:
            first = _split_sentences(section.content)
            if first:
                points.append(f"{section.title}: {first[0]}")
    notice = (
        "No hay un modelo de IA conectado. Este resumen se ha construido con fragmentos "
        "literales del libro; no se ha inventado nada."
    )
    return title, summary_text, points, citations, "extractive", notice


def estimate_reading_minutes(book: Book) -> int:
    """Estimación sencilla a 220 palabras por minuto (≈ 1.200 caracteres)."""
    return max(1, round(book.total_chars / 1200))
