"""IA Studio: tabla ai_outputs (resumenes e infografias).

Revision ID: 0004_ai_studio
Revises: 0003_assistant_files
Create Date: 2026-03-01 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_ai_studio"
down_revision: str | None = "0003_assistant_files"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_outputs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "output_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("source", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ai_outputs_user_id", "ai_outputs", ["user_id"])
    op.create_index("ix_ai_outputs_source_document_id", "ai_outputs", ["source_document_id"])
    op.create_index("ix_ai_outputs_output_document_id", "ai_outputs", ["output_document_id"])


def downgrade() -> None:
    op.drop_table("ai_outputs")
