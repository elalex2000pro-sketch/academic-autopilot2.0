"""Endpoints de cursos/asignaturas."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.course import Course
from app.models.enums import SourcePlatform
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.services.realtime import notify

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseRead])
async def list_courses(current_user: CurrentUser, db: DbSession) -> list[Course]:
    result = await db.execute(
        select(Course).where(Course.user_id == current_user.id).order_by(Course.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate, current_user: CurrentUser, db: DbSession
) -> Course:
    """Crea una asignatura manual (sin plataforma externa)."""
    course = Course(
        user_id=current_user.id,
        source=SourcePlatform.manual,
        external_id=f"manual-{uuid.uuid4()}",
        name=payload.name,
        code=payload.code,
        color=payload.color,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    notify(current_user.id, "courses", {"action": "created", "id": str(course.id)})
    return course


@router.patch("/{course_id}", response_model=CourseRead)
async def update_course(
    course_id: uuid.UUID,
    payload: CourseUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Course:
    course = await _get_owned_course(db, current_user.id, course_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    await db.commit()
    await db.refresh(course)
    notify(current_user.id, "courses", {"action": "updated", "id": str(course.id)})
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_course(
    course_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    course = await _get_owned_course(db, current_user.id, course_id)
    await db.delete(course)
    await db.commit()
    notify(current_user.id, "courses", {"action": "deleted", "id": str(course_id)})


async def _get_owned_course(
    db: DbSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> Course:
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == user_id)
    )
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignatura no encontrada")
    return course
