"""Flashcards con repaso espaciado y examenes generados por IA."""
from __future__ import annotations

import json
import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.logging import get_logger
from app.db.base import utcnow
from app.models.flashcard import Flashcard
from app.models.notebook import Notebook
from app.models.quiz import Quiz
from app.schemas.learning import (
    FlashcardBulkCreate,
    FlashcardCreate,
    FlashcardRead,
    FlashcardReview,
    FlashcardReviewResult,
    FlashcardsGenerated,
    FlashcardUpdate,
    GenerateFromNotebook,
    QuizQuestion,
    QuizRead,
    QuizResult,
    QuizSubmit,
)
from app.services import ai_generate

logger = get_logger(__name__)
router = APIRouter(tags=["learning"])

_FLASHCARD_SYSTEM = (
    "Eres un profesor que crea flashcards de estudio en espanol. "
    "Devuelve SIEMPRE un JSON valido: {\"flashcards\": [{\"front\": \"pregunta corta\", "
    "\"back\": \"respuesta clara\"}]}. Crea entre 8 y 20 tarjetas, sin repetir ideas."
)
_QUIZ_SYSTEM = (
    "Eres un profesor que crea examenes tipo test en espanol. Devuelve SIEMPRE un JSON valido: "
    "{\"title\": \"...\", \"questions\": [{\"question\": \"...\", \"options\": [\"a\", \"b\", \"c\", \"d\"], "
    "\"answer\": 0, \"explanation\": \"...\"}]}. Crea entre 5 y 10 preguntas con 4 opciones y una sola correcta."
)


# ---------------------------------------------------------------------------
# Flashcards
# ---------------------------------------------------------------------------
@router.get("/flashcards", response_model=list[FlashcardRead])
async def list_flashcards(
    current_user: CurrentUser,
    db: DbSession,
    notebook_id: uuid.UUID | None = None,
    due_only: bool = Query(default=False),
) -> list[Flashcard]:
    stmt = select(Flashcard).where(Flashcard.user_id == current_user.id)
    if notebook_id is not None:
        stmt = stmt.where(Flashcard.notebook_id == notebook_id)
    if due_only:
        stmt = stmt.where(Flashcard.due_at <= utcnow())
    stmt = stmt.order_by(Flashcard.due_at.asc(), Flashcard.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/flashcards", response_model=FlashcardRead, status_code=status.HTTP_201_CREATED)
async def create_flashcard(
    payload: FlashcardCreate, current_user: CurrentUser, db: DbSession
) -> Flashcard:
    if payload.notebook_id is not None:
        await _get_owned_notebook(payload.notebook_id, current_user.id, db)
    card = Flashcard(
        user_id=current_user.id,
        notebook_id=payload.notebook_id,
        front=payload.front.strip(),
        back=payload.back.strip(),
        source="manual",
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return card


@router.post(
    "/flashcards/bulk",
    response_model=FlashcardsGenerated,
    status_code=status.HTTP_201_CREATED,
)
async def create_flashcards_bulk(
    payload: FlashcardBulkCreate, current_user: CurrentUser, db: DbSession
) -> FlashcardsGenerated:
    cards: list[Flashcard] = []
    for item in payload.flashcards:
        card = Flashcard(
            user_id=current_user.id,
            notebook_id=item.notebook_id,
            front=item.front.strip(),
            back=item.back.strip(),
            source="manual",
        )
        db.add(card)
        cards.append(card)
    await db.commit()
    for card in cards:
        await db.refresh(card)
    return FlashcardsGenerated(created=len(cards), source="manual", flashcards=cards)


@router.patch("/flashcards/{card_id}", response_model=FlashcardRead)
async def update_flashcard(
    card_id: uuid.UUID,
    payload: FlashcardUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Flashcard:
    card = await _get_owned_card(card_id, current_user.id, db)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(card, key, value)
    await db.commit()
    await db.refresh(card)
    return card


@router.delete("/flashcards/{card_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_flashcard(card_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    card = await _get_owned_card(card_id, current_user.id, db)
    await db.delete(card)
    await db.commit()


@router.post(
    "/flashcards/generate",
    response_model=FlashcardsGenerated,
    status_code=status.HTTP_201_CREATED,
)
async def generate_flashcards(
    payload: GenerateFromNotebook, current_user: CurrentUser, db: DbSession
) -> FlashcardsGenerated:
    notebook = await _get_owned_notebook(payload.notebook_id, current_user.id, db)
    content = (notebook.content or "").strip()
    if len(content) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cuaderno necesita mas contenido para generar tarjetas.",
        )

    source = "ai"
    pairs: list[tuple[str, str]] = []
    try:
        data = await ai_generate.generate_json(
            current_user,
            _FLASHCARD_SYSTEM,
            f"Cuaderno: {notebook.title}\n\n{content[:8000]}",
        )
        for item in data.get("flashcards", []):
            front = str(item.get("front", "")).strip()
            back = str(item.get("back", "")).strip()
            if front and back:
                pairs.append((front[:2000], back[:4000]))
    except Exception as exc:  # noqa: BLE001 - siempre hay plan B
        logger.warning("Flashcards con IA no disponible: %s", exc)
        source = "heuristic"

    if not pairs:
        pairs = _heuristic_pairs(content)
    if not pairs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudieron extraer ideas del cuaderno. Anade texto con conceptos o listas.",
        )

    pairs = pairs[:30]
    cards: list[Flashcard] = []
    for front, back in pairs:
        card = Flashcard(
            user_id=current_user.id,
            notebook_id=notebook.id,
            front=front,
            back=back,
            source=source,
        )
        db.add(card)
        cards.append(card)
    await db.commit()
    for card in cards:
        await db.refresh(card)
    return FlashcardsGenerated(created=len(cards), source=source, flashcards=cards)


@router.post("/flashcards/{card_id}/review", response_model=FlashcardReviewResult)
async def review_flashcard(
    card_id: uuid.UUID,
    payload: FlashcardReview,
    current_user: CurrentUser,
    db: DbSession,
) -> FlashcardReviewResult:
    card = await _get_owned_card(card_id, current_user.id, db)
    quality = payload.quality

    # SM-2 simplificado: calidad < 3 reinicia el intervalo.
    if quality < 3:
        card.repetitions = 0
        card.interval_days = 1
    else:
        if card.repetitions == 0:
            card.interval_days = 1
        elif card.repetitions == 1:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease))
        card.repetitions += 1

    card.ease = max(
        1.3, card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    )
    card.due_at = utcnow() + timedelta(days=card.interval_days)
    await db.commit()
    await db.refresh(card)
    return FlashcardReviewResult(
        card=FlashcardRead.model_validate(card),
        next_due=card.due_at,
        interval_days=card.interval_days,
    )


@router.get("/flashcards/stats")
async def flashcard_stats(current_user: CurrentUser, db: DbSession) -> dict[str, int]:
    now = utcnow()
    total = await db.scalar(
        select(func.count()).select_from(Flashcard).where(Flashcard.user_id == current_user.id)
    )
    due = await db.scalar(
        select(func.count())
        .select_from(Flashcard)
        .where(Flashcard.user_id == current_user.id, Flashcard.due_at <= now)
    )
    return {"total": int(total or 0), "due": int(due or 0)}


# ---------------------------------------------------------------------------
# Examenes (quizzes)
# ---------------------------------------------------------------------------
@router.post("/quizzes/generate", response_model=QuizRead, status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    payload: GenerateFromNotebook, current_user: CurrentUser, db: DbSession
) -> QuizRead:
    notebook = await _get_owned_notebook(payload.notebook_id, current_user.id, db)
    content = (notebook.content or "").strip()
    if len(content) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cuaderno necesita mas contenido para crear un examen.",
        )

    title = f"Examen: {notebook.title}"
    source = "ai"
    questions: list[dict] = []
    try:
        data = await ai_generate.generate_json(
            current_user,
            _QUIZ_SYSTEM,
            f"Cuaderno: {notebook.title}\n\n{content[:8000]}",
            max_tokens=2000,
        )
        title = str(data.get("title") or title)[:300]
        for item in data.get("questions", []):
            question = str(item.get("question", "")).strip()
            options = [str(option).strip() for option in item.get("options", []) if str(option).strip()]
            answer = int(item.get("answer", 0))
            if question and len(options) >= 2 and 0 <= answer < len(options):
                questions.append(
                    {
                        "question": question,
                        "options": options[:4],
                        "answer": answer,
                        "explanation": str(item.get("explanation", "")).strip(),
                    }
                )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Examen con IA no disponible: %s", exc)
        source = "heuristic"

    if not questions:
        questions = _heuristic_questions(content)
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay suficiente contenido para generar preguntas.",
        )

    quiz = Quiz(
        user_id=current_user.id,
        notebook_id=notebook.id,
        title=title,
        questions=json.dumps(questions, ensure_ascii=False),
        source=source,
        total=len(questions),
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)
    return _quiz_read(quiz)


@router.get("/quizzes", response_model=list[QuizRead])
async def list_quizzes(current_user: CurrentUser, db: DbSession) -> list[QuizRead]:
    result = await db.execute(
        select(Quiz).where(Quiz.user_id == current_user.id).order_by(Quiz.created_at.desc())
    )
    return [_quiz_read(quiz) for quiz in result.scalars().all()]


@router.get("/quizzes/{quiz_id}", response_model=QuizRead)
async def get_quiz(quiz_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> QuizRead:
    return _quiz_read(await _get_owned_quiz(quiz_id, current_user.id, db))


@router.post("/quizzes/{quiz_id}/submit", response_model=QuizResult)
async def submit_quiz(
    quiz_id: uuid.UUID,
    payload: QuizSubmit,
    current_user: CurrentUser,
    db: DbSession,
) -> QuizResult:
    quiz = await _get_owned_quiz(quiz_id, current_user.id, db)
    questions = json.loads(quiz.questions)
    details = [
        index < len(payload.answers) and payload.answers[index] == question.get("answer")
        for index, question in enumerate(questions)
    ]
    score = sum(1 for ok in details if ok)
    quiz.score = score
    quiz.total = len(questions)
    quiz.completed_at = utcnow()
    await db.commit()
    await db.refresh(quiz)
    return QuizResult(
        quiz=_quiz_read(quiz), score=score, total=quiz.total, details=details
    )


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_quiz(quiz_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    quiz = await _get_owned_quiz(quiz_id, current_user.id, db)
    await db.delete(quiz)
    await db.commit()


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def _quiz_read(quiz: Quiz) -> QuizRead:
    questions = [QuizQuestion(**item) for item in json.loads(quiz.questions)]
    return QuizRead(
        id=quiz.id,
        notebook_id=quiz.notebook_id,
        title=quiz.title,
        source=quiz.source,
        questions=questions,
        score=quiz.score,
        total=quiz.total,
        completed_at=quiz.completed_at,
        created_at=quiz.created_at,
    )


def _heuristic_pairs(content: str) -> list[tuple[str, str]]:
    """Extrae tarjetas de encabezados con vinetas o lineas 'concepto: definicion'."""
    pairs: list[tuple[str, str]] = []
    heading: str | None = None
    bullets: list[str] = []

    def flush() -> None:
        nonlocal heading, bullets
        if heading and bullets:
            pairs.append((f"¿Que es {heading}?", "; ".join(bullets[:5])))
        heading, bullets = None, []

    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            flush()
            heading = line.lstrip("#").strip()
            continue
        if line.startswith(("- ", "* ", "+ ")):
            item = line[2:].strip()
            if heading:
                bullets.append(item)
            elif ":" in item:
                left, right = item.split(":", 1)
                if left.strip() and right.strip():
                    pairs.append((left.strip(), right.strip()))
            continue
        if ":" in line and len(line) < 300:
            left, right = line.split(":", 1)
            if 2 <= len(left.strip()) <= 90 and right.strip():
                pairs.append((left.strip(), right.strip()))
    flush()

    if not pairs:
        for line in content.splitlines():
            text = line.strip(" -#\t")
            if len(text) >= 15 and not text.endswith(":"):
                pairs.append((f"¿Que recuerdas de «{text[:50]}»?", text[:500]))
            if len(pairs) >= 12:
                break
    return pairs[:30]


def _heuristic_questions(content: str) -> list[dict]:
    pairs = [pair for pair in _heuristic_pairs(content) if len(pair[0]) <= 120]
    if len(pairs) < 2:
        return []

    questions: list[dict] = []
    answers = [pair[1] for pair in pairs]
    for index, (front, back) in enumerate(pairs[:8]):
        distractors = [answer for answer in answers if answer != back][:3]
        if len(distractors) < 3:
            continue
        options = [back, *distractors]
        # Rotacion determinista para que la correcta no quede siempre primera.
        shift = index % len(options)
        options = options[shift:] + options[:shift]
        questions.append(
            {
                "question": front if front.endswith("?") else f"¿Que se relaciona con «{front}»?",
                "options": options,
                "answer": options.index(back),
                "explanation": f"Respuesta correcta: {back}",
            }
        )
    return questions


async def _get_owned_notebook(
    notebook_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> Notebook:
    notebook = await db.get(Notebook, notebook_id)
    if notebook is None or notebook.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuaderno no encontrado")
    return notebook


async def _get_owned_card(card_id: uuid.UUID, user_id: uuid.UUID, db: DbSession) -> Flashcard:
    card = await db.get(Flashcard, card_id)
    if card is None or card.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarjeta no encontrada")
    return card


async def _get_owned_quiz(quiz_id: uuid.UUID, user_id: uuid.UUID, db: DbSession) -> Quiz:
    quiz = await db.get(Quiz, quiz_id)
    if quiz is None or quiz.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Examen no encontrado")
    return quiz
