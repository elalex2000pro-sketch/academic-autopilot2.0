"""Estado de entrega (ticks) de los mensajes del chat.

Revision ID: 0019_chat_message_status
Revises: 0018_important_dates
Create Date: 2026-11-10 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_chat_message_status"
down_revision: str | None = "0018_important_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column(
            "status",
            sa.String(length=12),
            nullable=False,
            server_default="sent",
        ),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "status")
