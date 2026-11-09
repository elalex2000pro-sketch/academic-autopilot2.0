"""Fechas importantes del planificador.

Revision ID: 0018_important_dates
Revises: 0017_chat_usernames
Create Date: 2026-11-09 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_important_dates"
down_revision: str | None = "0017_chat_usernames"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "important_dates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_important_dates_user_id", "important_dates", ["user_id"])
    op.create_index("ix_important_dates_date", "important_dates", ["date"])


def downgrade() -> None:
    op.drop_index("ix_important_dates_date", table_name="important_dates")
    op.drop_index("ix_important_dates_user_id", table_name="important_dates")
    op.drop_table("important_dates")
