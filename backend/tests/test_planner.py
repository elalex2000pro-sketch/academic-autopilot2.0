"""Pruebas del motor de planificacion (funciones puras, sin BD)."""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from app.models.enums import TaskPriority
from app.services.planner import (
    AvailabilityBlock,
    PlannerTask,
    build_plan,
    split_minutes,
)


def test_split_minutes_respeta_maximo():
    parts = split_minutes(200, max_minutes=90, min_minutes=30)
    assert sum(parts) == 200
    assert all(p <= 90 for p in parts)
    assert all(p >= 30 for p in parts)


def test_split_minutes_no_deja_residuo_corto():
    parts = split_minutes(95, max_minutes=90, min_minutes=30)
    # No debe generar una sesion de 5 minutos.
    assert all(p >= 30 for p in parts)


def test_split_minutes_no_infla_tareas_cortas():
    # Una tarea de 10 minutos ocupa 10 minutos: no se infla al minimo.
    assert split_minutes(10, max_minutes=90, min_minutes=30) == [10]
    assert split_minutes(45, max_minutes=90, min_minutes=30) == [45]


def test_prioridad_urgente_por_fecha():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    task = PlannerTask(task_id="t1", title="Examen", estimated_minutes=60,
                       due_at=now + timedelta(hours=10))
    result = build_plan([task], [], now=now)
    assert result.plans[0].priority == TaskPriority.urgent


def test_prioridad_proyecto_largo():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    task = PlannerTask(task_id="t1", title="Proyecto", estimated_minutes=300,
                       due_at=now + timedelta(days=30))
    result = build_plan([task], [], now=now)
    assert result.plans[0].priority == TaskPriority.long_project


def test_planifica_en_hueco_disponible():
    # Lunes 5 de enero de 2026; hueco de 16:30 a 20:30 (240 min).
    now = datetime(2026, 1, 5, 8, 0, tzinfo=timezone.utc)
    blocks = [AvailabilityBlock(day_of_week=0, start_time=time(16, 30), end_time=time(20, 30))]
    task = PlannerTask(task_id="t1", title="Ensayo", estimated_minutes=80)
    result = build_plan([task], blocks, now=now, user_tz="UTC")

    plan = result.plans[0]
    assert plan.sessions, "La tarea deberia haberse programado"
    first = plan.sessions[0]
    assert first.start_at.hour == 16 and first.start_at.minute == 30
    assert first.duration_minutes == 80


def test_trocea_tarea_larga_en_varias_sesiones():
    now = datetime(2026, 1, 5, 8, 0, tzinfo=timezone.utc)
    blocks = [
        AvailabilityBlock(day_of_week=0, start_time=time(16, 30), end_time=time(20, 30)),
        AvailabilityBlock(day_of_week=1, start_time=time(16, 30), end_time=time(20, 30)),
    ]
    task = PlannerTask(task_id="t1", title="Tesina", estimated_minutes=300)
    result = build_plan([task], blocks, now=now, user_tz="UTC")
    plan = result.plans[0]
    assert len(plan.sessions) >= 2
    assert plan.scheduled_minutes == 300


def test_no_programa_pasado_el_deadline_efectivo():
    # Deadline en 30h -> deadline efectivo en 6h (margen 24h).
    now = datetime(2026, 1, 5, 8, 0, tzinfo=timezone.utc)
    blocks = [AvailabilityBlock(day_of_week=3, start_time=time(16, 30), end_time=time(20, 30))]
    task = PlannerTask(
        task_id="t1",
        title="Entrega",
        estimated_minutes=60,
        due_at=now + timedelta(hours=30),
    )
    result = build_plan([task], blocks, now=now, user_tz="UTC")
    # El unico hueco cae despues del deadline efectivo -> sin programar.
    assert "t1" in result.unscheduled_task_ids
