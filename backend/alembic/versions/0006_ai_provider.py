"""Ajustes de IA por usuario: proveedor hibrido (local/gemini) y clave API.

Revision ID: 0006_ai_provider
Revises: 0005_assistant_image
Create Date: 2026-04-02 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_ai_provider"
down_revision: str | None = "0005_assistant_image"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "ai_provider",
            sa.String(length=16),
            nullable=False,
            server_default="local",
        ),
    )
    op.add_column(
        "users",
        sa.Column("ai_api_key_encrypted", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "ai_api_key_encrypted")
    op.drop_column("users", "ai_provider")
