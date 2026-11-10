"""Verificación de cuenta con correo institucional (tick del chat).

Revision ID: 0020_user_verification
Revises: 0019_chat_message_status
Create Date: 2026-11-10 16:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_user_verification"
down_revision: str | None = "0019_chat_message_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "users",
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("institutional_email", sa.String(length=320), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "institutional_email")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "is_verified")
