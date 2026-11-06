"""Chat (privado y grupal) con adjuntos y @usuario unico.

Revision ID: 0017_chat_usernames
Revises: 0016_password_recovery
Create Date: 2026-11-06 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_chat_usernames"
down_revision: str | None = "0016_password_recovery"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- @usuario unico -----------------------------------------------------
    op.add_column("users", sa.Column("username", sa.String(24), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # --- conversaciones -----------------------------------------------------
    op.create_table(
        "chat_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("direct_key", sa.String(80), nullable=True),
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
        sa.UniqueConstraint("direct_key", name="uq_chat_direct_key"),
    )
    op.create_index(
        "ix_chat_conversations_owner_id", "chat_conversations", ["owner_id"]
    )

    # --- miembros -----------------------------------------------------------
    op.create_table(
        "chat_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(16), nullable=False, server_default="member"),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint(
            "conversation_id", "user_id", name="uq_chat_member"
        ),
    )
    op.create_index(
        "ix_chat_members_conversation_id", "chat_members", ["conversation_id"]
    )
    op.create_index("ix_chat_members_user_id", "chat_members", ["user_id"])

    # --- mensajes -----------------------------------------------------------
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("attachment_name", sa.String(300), nullable=True),
        sa.Column("attachment_type", sa.String(120), nullable=True),
        sa.Column("attachment_size", sa.Integer(), nullable=True),
        sa.Column("attachment_path", sa.String(500), nullable=True),
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
    op.create_index(
        "ix_chat_messages_conversation_id", "chat_messages", ["conversation_id"]
    )
    op.create_index("ix_chat_messages_sender_id", "chat_messages", ["sender_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_sender_id", table_name="chat_messages")
    op.drop_index(
        "ix_chat_messages_conversation_id", table_name="chat_messages"
    )
    op.drop_table("chat_messages")

    op.drop_index("ix_chat_members_user_id", table_name="chat_members")
    op.drop_index("ix_chat_members_conversation_id", table_name="chat_members")
    op.drop_table("chat_members")

    op.drop_index(
        "ix_chat_conversations_owner_id", table_name="chat_conversations"
    )
    op.drop_table("chat_conversations")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_column("users", "username")
