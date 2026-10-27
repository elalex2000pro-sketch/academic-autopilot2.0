"""Recuperacion de contrasena con pregunta de seguridad.

Revision ID: 0016_password_recovery
Revises: 0015_assistant_attachments
Create Date: 2026-10-27 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_password_recovery"
down_revision: str | None = "0015_assistant_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("recovery_question", sa.String(200), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("recovery_answer_hash", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
    op.drop_column("users", "recovery_answer_hash")
    op.drop_column("users", "recovery_question")
