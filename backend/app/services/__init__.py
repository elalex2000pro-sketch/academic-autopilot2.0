"""Servicios de dominio.

Este `__init__` solo reexporta el motor de planificacion puro (sin dependencias
pesadas). El servicio de sincronizacion y el de persistencia se importan desde
sus modulos para no arrastrar clientes externos (Google, etc.) innecesariamente.
"""
from app.services.planner import (
    PlanningResult,
    build_plan,
    classify_priority,
    split_minutes,
)

__all__ = [
    "PlanningResult",
    "build_plan",
    "classify_priority",
    "split_minutes",
]
