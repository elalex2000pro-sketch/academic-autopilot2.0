"""Endpoints de calificaciones (notas) y resumen por asignatura."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.course import Course
from app.models.grade import Grade
from app.models.user import User
from app.schemas.grade import (
    CourseGradeSummary,
    GradeCreate,
    GradeRead,
    GradeSummary,
    GradeUpdate,
)
from app.services.realtime import notify

router = APIRouter(prefix="/grades", tags=["grades"])


@router.get("", response_model=list[GradeRead])
async def list_grades(
    current_user: CurrentUser,
    db: DbSession,
    course_id: uuid.UUID | None = None,
) -> list[Grade]:
    stmt = select(Grade).where(Grade.user_id == current_user.id)
    if course_id is not None:
        stmt = stmt.where(Grade.course_id == course_id)
    stmt = stmt.order_by(Grade.graded_at.desc().nulls_last(), Grade.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=GradeRead, status_code=status.HTTP_201_CREATED)
async def create_grade(
    payload: GradeCreate, current_user: CurrentUser, db: DbSession
) -> Grade:
    grade = Grade(user_id=current_user.id, **payload.model_dump())
    db.add(grade)
    await db.commit()
    await db.refresh(grade)
    notify(current_user.id, "grades", {"action": "created", "id": str(grade.id)})
    return grade


@router.get("/summary", response_model=GradeSummary)
async def grade_summary(current_user: CurrentUser, db: DbSession) -> GradeSummary:
    """Media por asignatura (ponderada si hay pesos) y media global."""
    result = await db.execute(select(Grade).where(Grade.user_id == current_user.id))
    grades = list(result.scalars().all())

    names = await _course_name_map(db, current_user)

    grouped: dict[uuid.UUID | None, list[Grade]] = {}
    for grade in grades:
        grouped.setdefault(grade.course_id, []).append(grade)

    summaries: list[CourseGradeSummary] = []
    all_pairs: list[tuple[float, float | None]] = []
    graded_total = 0

    for course_id, items in grouped.items():
        pairs = [
            (g.percentage, g.weight) for g in items if g.percentage is not None
        ]
        graded_total += len(pairs)
        all_pairs.extend(pairs)
        weights = [w for _, w in pairs if w is not None]
        summaries.append(
            CourseGradeSummary(
                course_id=course_id,
                course_name=names.get(course_id) if course_id else None,
                average_percent=_weighted_average(pairs),
                graded_count=len(pairs),
                total_weight=round(sum(weights), 2) if weights else None,
            )
        )

    summaries.sort(key=lambda s: (s.course_name or "").lower())

    return GradeSummary(
        overall_average_percent=_weighted_average(all_pairs),
        graded_count=graded_total,
        courses=summaries,
    )


@router.patch("/{grade_id}", response_model=GradeRead)
async def update_grade(
    grade_id: uuid.UUID,
    payload: GradeUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Grade:
    grade = await _get_owned_grade(db, current_user.id, grade_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(grade, field, value)
    await db.commit()
    await db.refresh(grade)
    notify(current_user.id, "grades", {"action": "updated", "id": str(grade.id)})
    return grade


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_grade(
    grade_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    grade = await _get_owned_grade(db, current_user.id, grade_id)
    await db.delete(grade)
    await db.commit()
    notify(current_user.id, "grades", {"action": "deleted", "id": str(grade_id)})


async def _get_owned_grade(
    db: DbSession, user_id: uuid.UUID, grade_id: uuid.UUID
) -> Grade:
    result = await db.execute(
        select(Grade).where(Grade.id == grade_id, Grade.user_id == user_id)
    )
    grade = result.scalar_one_or_none()
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota no encontrada")
    return grade


async def _course_name_map(db: DbSession, user: User) -> dict:
    result = await db.execute(select(Course.id, Course.name).where(Course.user_id == user.id))
    return {row.id: row.name for row in result.all()}


def _weighted_average(pairs: list[tuple[float, float | None]]) -> float | None:
    """Media ponderada por peso; si falta algun peso, media simple."""
    if not pairs:
        return None
    weights = [w for _, w in pairs if w is not None]
    if len(weights) == len(pairs) and sum(weights) > 0:
        total_weight = sum(weights)
        return round(sum(p * w for p, w in pairs) / total_weight, 2)
    return round(sum(p for p, _ in pairs) / len(pairs), 2)
