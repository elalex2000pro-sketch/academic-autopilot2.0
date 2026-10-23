"""Profesor de asignaturas y lectura de PDFs escaneados.

Revision ID: 0013_academics_pdf_fallback
Revises: 0012_books_classwork
Create Date: 2026-10-23 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_academics_pdf_fallback"
down_revision: str | None = "0012_books_classwork"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("teacher", sa.String(200), nullable=True))
    op.add_column(
        "books",
        sa.Column(
            "text_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("books", "text_available")
    op.drop_column("courses", "teacher")
