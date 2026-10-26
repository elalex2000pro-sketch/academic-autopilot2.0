"""Marca de examen en las calificaciones.

Revision ID: 0014_grade_is_exam
Revises: 0013_academics_pdf_fallback
Create Date: 2026-10-26 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_grade_is_exam"
down_revision: str | None = "0013_academics_pdf_fallback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "grades",
        sa.Column("is_exam", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("grades", "is_exam")
