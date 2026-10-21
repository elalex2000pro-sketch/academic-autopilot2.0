"""Carga el horario del ciclo para el usuario que aun no tiene horario.

Se ejecuta automaticamente al iniciar la app (ver "2 - Iniciar...").
Es idempotente: si un usuario ya tiene clases, no se toca.
No crea ninguna cuenta: usa las que existan.
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import time as dtime

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.course import Course
from app.models.enums import SourcePlatform
from app.models.timetable_entry import TimetableEntry
from app.models.user import User

COURSES: list[tuple[str, str]] = [
    ("Aplicaciones Ofimáticas", "#3b82f6"),
    ("Redes Locales", "#10b981"),
    ("Montaje y Mantenimiento de Equipos", "#f59e0b"),
    ("Sistemas Operativos Monopuesto", "#8b5cf6"),
    ("Itinerario Personal para la Empleabilidad I", "#ec4899"),
    ("Sostenibilidad Aplicada al Sistema Productivo", "#84cc16"),
    ("Digitalización Aplicada a los Sectores Productivos", "#f43f5e"),
]

# (dia 0=Lunes..4=Viernes, inicio, fin, asignatura)
SCHEDULE: list[tuple[int, str, str, str]] = [
    # Lunes
    (0, "08:15", "09:15", "Aplicaciones Ofimáticas"),
    (0, "09:15", "10:15", "Aplicaciones Ofimáticas"),
    (0, "10:15", "11:15", "Redes Locales"),
    (0, "11:45", "12:45", "Redes Locales"),
    (0, "12:45", "13:45", "Montaje y Mantenimiento de Equipos"),
    (0, "13:45", "14:45", "Montaje y Mantenimiento de Equipos"),
    # Martes
    (1, "08:15", "09:15", "Montaje y Mantenimiento de Equipos"),
    (1, "09:15", "10:15", "Sistemas Operativos Monopuesto"),
    (1, "10:15", "11:15", "Sistemas Operativos Monopuesto"),
    (1, "11:45", "12:45", "Aplicaciones Ofimáticas"),
    (1, "12:45", "13:45", "Itinerario Personal para la Empleabilidad I"),
    (1, "13:45", "14:45", "Redes Locales"),
    # Miércoles
    (2, "08:15", "09:15", "Montaje y Mantenimiento de Equipos"),
    (2, "09:15", "10:15", "Sistemas Operativos Monopuesto"),
    (2, "10:15", "11:15", "Aplicaciones Ofimáticas"),
    (2, "11:45", "12:45", "Aplicaciones Ofimáticas"),
    (2, "12:45", "13:45", "Redes Locales"),
    (2, "13:45", "14:45", "Redes Locales"),
    # Jueves
    (3, "08:15", "09:15", "Aplicaciones Ofimáticas"),
    (3, "09:15", "10:15", "Aplicaciones Ofimáticas"),
    (3, "10:15", "11:15", "Redes Locales"),
    (3, "11:45", "12:45", "Itinerario Personal para la Empleabilidad I"),
    (3, "12:45", "13:45", "Montaje y Mantenimiento de Equipos"),
    (3, "13:45", "14:45", "Montaje y Mantenimiento de Equipos"),
    # Viernes
    (4, "08:15", "09:15", "Sostenibilidad Aplicada al Sistema Productivo"),
    (4, "09:15", "10:15", "Digitalización Aplicada a los Sectores Productivos"),
    (4, "10:15", "11:15", "Redes Locales"),
    (4, "11:45", "12:45", "Itinerario Personal para la Empleabilidad I"),
    (4, "12:45", "13:45", "Sistemas Operativos Monopuesto"),
    (4, "13:45", "14:45", "Sistemas Operativos Monopuesto"),
]


def _t(value: str) -> dtime:
    h, m = value.split(":")
    return dtime(int(h), int(m))


async def seed_user(db, user: User) -> int:
    """Crea asignaturas y clases para un usuario sin horario. Devuelve las clases creadas."""
    existing_courses = {
        c.name: c
        for c in (
            (await db.execute(select(Course).where(Course.user_id == user.id)))
            .scalars()
            .all()
        )
    }
    for name, color in COURSES:
        if name not in existing_courses:
            course = Course(
                user_id=user.id,
                source=SourcePlatform.manual,
                external_id=f"manual-{uuid.uuid4()}",
                name=name,
                color=color,
            )
            db.add(course)
            existing_courses[name] = course
    await db.flush()

    created = 0
    for day, start, end, subject in SCHEDULE:
        db.add(
            TimetableEntry(
                user_id=user.id,
                course_id=existing_courses[subject].id if subject in existing_courses else None,
                title=subject,
                day_of_week=day,
                start_time=_t(start),
                end_time=_t(end),
            )
        )
        created += 1
    return created


async def main() -> None:
    # Argumento opcional: cargar solo para un email concreto.
    target = sys.argv[1].strip().lower() if len(sys.argv) > 1 else None

    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        if target:
            users = [u for u in users if u.email.lower() == target]
        if not users:
            print("No hay ninguna cuenta que cumpla la condicion. Registrate en la app y vuelve a intentarlo.")
            return

        seeded = 0
        for user in users:
            classes = (
                await db.execute(
                    select(func.count())
                    .select_from(TimetableEntry)
                    .where(TimetableEntry.user_id == user.id)
                )
            ).scalar_one()
            if classes:
                continue
            created = await seed_user(db, user)
            seeded += 1
            print(f"Horario cargado para {user.email}: {created} clases.")
        await db.commit()

        if seeded == 0:
            print("Los usuarios ya tenian horario. No se ha cambiado nada.")


if __name__ == "__main__":
    asyncio.run(main())
