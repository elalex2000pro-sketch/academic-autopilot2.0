"""Multi-proveedor de IA (ChatGPT, Claude, OpenRouter...) y examenes en clases.

Revision ID: 0009_multi_ai_exams
Revises: 0008_upload_sessions
Create Date: 2026-10-19 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_multi_ai_exams"
down_revision: str | None = "0008_upload_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Modelo y URL base personalizados por usuario (nuevos proveedores de IA).
    op.add_column("users", sa.Column("ai_model", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("ai_base_url", sa.String(length=300), nullable=True))
    # Marca de examen en el calendario conjunto de las clases compartidas.
    op.add_column(
        "class_events",
        sa.Column("is_exam", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("class_events", "is_exam")
    op.drop_column("users", "ai_base_url")
    op.drop_column("users", "ai_model")
