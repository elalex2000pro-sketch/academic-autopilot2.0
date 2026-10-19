"""Asistente IA: adjuntar imagen (document_id) a los mensajes.

Revision ID: 0005_assistant_image
Revises: 0004_ai_studio
Create Date: 2026-04-01 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_assistant_image"
down_revision: str | None = "0004_ai_studio"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "assistant_messages",
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_assistant_messages_document_id", "assistant_messages", ["document_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_assistant_messages_document_id", table_name="assistant_messages")
    op.drop_column("assistant_messages", "document_id")
