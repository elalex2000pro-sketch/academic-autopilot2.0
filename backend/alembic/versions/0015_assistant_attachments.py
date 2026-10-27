"""Miniaturas de adjuntos en los mensajes del asistente.

Revision ID: 0015_assistant_attachments
Revises: 0014_grade_is_exam
Create Date: 2026-10-26 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0015_assistant_attachments"
down_revision: str | None = "0014_grade_is_exam"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "assistant_messages",
        sa.Column(
            "attachments",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("assistant_messages", "attachments")
