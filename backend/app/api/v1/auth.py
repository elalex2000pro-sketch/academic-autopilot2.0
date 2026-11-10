"""Endpoints de autenticacion (registro, login, perfil y recuperacion)."""
import re
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    hash_password,
    normalize_recovery_answer,
    verify_password,
)
from app.models.user import User
from app.schemas.chat import UsernameAvailability, UsernameUpdate
from app.schemas.auth import (
    PasswordResetRequest,
    RecoveryQuestionRead,
    RecoveryQuestionRequest,
    RecoverySetup,
    Token,
    UserLogin,
    UserRead,
    UserRegister,
    VerificationRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_MAX_RECOVERY_ANSWER_BYTES = 72  # limite de bcrypt

# Nombre publico del chat: minusculas, numeros y guion bajo.
_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")


def _clean_username(value: str) -> str:
    return (value or "").strip().lstrip("@").lower()


def _normalize_recovery_pair(
    question: str | None, answer: str | None
) -> tuple[str | None, str | None]:
    """Valida y normaliza la pareja pregunta/respuesta de seguridad."""
    clean_question = (question or "").strip()
    clean_answer = normalize_recovery_answer(answer or "")

    if not clean_question and not clean_answer:
        return None, None
    if not clean_question or not clean_answer:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La pregunta y la respuesta de seguridad deben ir juntas",
        )
    if len(clean_question) < 4:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La pregunta de seguridad debe tener al menos 4 caracteres",
        )
    if len(clean_answer) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La respuesta de seguridad debe tener al menos 2 caracteres",
        )
    if len(clean_answer.encode("utf-8")) > _MAX_RECOVERY_ANSWER_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La respuesta de seguridad es demasiado larga",
        )
    return clean_question, clean_answer


def _token_for(user: User) -> Token:
    """Emite un JWT ligado a la version de contrasena del usuario."""
    return Token(
        access_token=create_access_token(
            user.id, {"ver": int(user.token_version or 0)}
        )
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, payload: UserRegister, db: DbSession) -> Token:
    """Crea una cuenta y devuelve un token de acceso."""
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con ese email",
        )

    recovery_question, recovery_answer = _normalize_recovery_pair(
        payload.recovery_question, payload.recovery_answer
    )

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        timezone=payload.timezone,
        recovery_question=recovery_question,
        recovery_answer_hash=(
            hash_password(recovery_answer) if recovery_answer is not None else None
        ),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=Token)
@limiter.limit("20/minute")
async def login(request: Request, payload: UserLogin, db: DbSession) -> Token:
    """Valida credenciales y emite un JWT."""
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contrasena incorrectos",
        )
    return _token_for(user)


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser) -> User:
    """Devuelve el perfil del usuario autenticado."""
    return current_user


@router.post("/recovery/question", response_model=RecoveryQuestionRead)
@limiter.limit("10/minute")
async def recovery_question(
    request: Request, payload: RecoveryQuestionRequest, db: DbSession
) -> RecoveryQuestionRead:
    """Devuelve la pregunta de seguridad de una cuenta, si existe.

    La respuesta es generica para no confirmar si un email esta registrado.
    """
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not user.has_recovery:
        return RecoveryQuestionRead(available=False)
    return RecoveryQuestionRead(available=True, question=user.recovery_question)


@router.post("/recovery/reset", response_model=Token)
@limiter.limit("5/minute")
async def reset_password(
    request: Request, payload: PasswordResetRequest, db: DbSession
) -> Token:
    """Restablece la contrasena con la respuesta de seguridad."""
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    generic_error = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "No se pudo restablecer la contrasena. Revisa el email o configura "
            "una pregunta de seguridad desde Ajustes."
        ),
    )
    if user is None or not user.recovery_answer_hash:
        raise generic_error

    answer = normalize_recovery_answer(payload.answer)
    if (
        len(answer) < 2
        or len(answer.encode("utf-8")) > _MAX_RECOVERY_ANSWER_BYTES
        or not verify_password(answer, user.recovery_answer_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La respuesta de seguridad no es correcta.",
        )

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = int(user.token_version or 0) + 1
    await db.commit()
    await db.refresh(user)
    return _token_for(user)


@router.put("/recovery", response_model=UserRead)
async def set_recovery(
    payload: RecoverySetup, current_user: CurrentUser, db: DbSession
) -> User:
    """Configura o actualiza la pregunta de seguridad de la cuenta."""
    question, answer = _normalize_recovery_pair(payload.question, payload.answer)
    assert question is not None and answer is not None

    current_user.recovery_question = question
    current_user.recovery_answer_hash = hash_password(answer)
    await db.commit()
    await db.refresh(current_user)
    return current_user


# Dominios educativos habituales que no siguen el patrón .edu / .ac.
_ACADEMIC_DOMAIN_SUFFIXES = (
    ".unam.mx",
    ".ipn.mx",
    ".itesm.mx",
    ".tec.mx",
    ".us.es",
    ".ucm.es",
    ".upv.es",
    ".ull.es",
    ".ugr.es",
    ".unizar.es",
    ".uam.es",
    ".uma.es",
    ".usal.es",
    ".unex.es",
    ".uvigo.es",
    ".upf.edu",
    ".uoc.edu",
    ".uned.es",
    ".uchile.cl",
    ".puc.cl",
    ".usach.cl",
    ".udec.cl",
    ".uv.cl",
    ".uba.ar",
    ".unlp.edu.ar",
    ".unal.edu.co",
    ".uniandes.edu.co",
    ".udelar.edu.uy",
    ".unmsm.edu.pe",
    ".ulima.edu.pe",
)
_EDU_DOMAIN_RE = re.compile(r"\.edu(\.[a-z]{2,3})?$")
_AC_DOMAIN_RE = re.compile(r"\.ac\.[a-z]{2,3}$")


def _is_academic_domain(email: str) -> bool:
    """Comprueba que el correo pertenece a una institución educativa."""
    domain = email.rsplit("@", 1)[-1].strip().lower()
    if not domain or "." not in domain:
        return False
    return bool(
        _EDU_DOMAIN_RE.search(domain)
        or _AC_DOMAIN_RE.search(domain)
        or domain.endswith(_ACADEMIC_DOMAIN_SUFFIXES)
    )


@router.post("/verification", response_model=UserRead)
async def request_verification(
    payload: VerificationRequest, current_user: CurrentUser, db: DbSession
) -> User:
    """Acredita la cuenta con un correo institucional y activa el tick."""
    email = str(payload.institutional_email).strip().lower()
    if not _is_academic_domain(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Usa un correo de tu institución educativa "
                "(por ejemplo, tu.nombre@universidad.edu)."
            ),
        )
    current_user.is_verified = True
    current_user.verified_at = datetime.now(UTC)
    current_user.institutional_email = email
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/username/available", response_model=UsernameAvailability)
async def username_available(
    db: DbSession, value: str = Query(..., min_length=1, max_length=40)
) -> UsernameAvailability:
    """Comprueba si un @usuario del chat esta libre."""
    username = _clean_username(value)
    if not _USERNAME_RE.fullmatch(username):
        return UsernameAvailability(
            username=username,
            valid=False,
            available=False,
            reason="Entre 3 y 24 caracteres: minusculas, numeros o guion bajo",
        )
    taken = (
        await db.execute(select(User.id).where(User.username == username))
    ).first()
    return UsernameAvailability(
        username=username,
        valid=True,
        available=taken is None,
        reason=None if taken is None else "Ese @usuario ya esta en uso",
    )


@router.put("/username", response_model=UserRead)
async def update_username(
    payload: UsernameUpdate, current_user: CurrentUser, db: DbSession
) -> User:
    """Elige el @usuario publico con el que te encuentran en el chat."""
    username = _clean_username(payload.username)
    if not _USERNAME_RE.fullmatch(username):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Entre 3 y 24 caracteres: minusculas, numeros o guion bajo",
        )
    existing = (
        await db.execute(
            select(User).where(
                User.username == username, User.id != current_user.id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese @usuario ya esta en uso",
        )
    current_user.username = username
    await db.commit()
    await db.refresh(current_user)
    return current_user
