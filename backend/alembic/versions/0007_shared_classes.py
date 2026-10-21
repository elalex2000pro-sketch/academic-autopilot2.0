"""Clases compartidas: grupos con codigo permanente, chat, calendario y archivos.

Revision ID: 0007_shared_classes
Revises: 0006_ai_provider
Create Date: 2026-10-19 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_shared_classes"
down_revision: str | None = "0006_ai_provider"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------- shared_classes
    op.create_table(
        "shared_classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("code", sa.String(12), nullable=False),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_shared_classes_code", "shared_classes", ["code"], unique=True)
    op.create_index("ix_shared_classes_owner_id", "shared_classes", ["owner_id"])

    # ---------------------------------------------------- class_memberships
    op.create_table(
        "class_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "class_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shared_classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(16), nullable=False, server_default="member"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("class_id", "user_id", name="uq_class_membership"),
    )
    op.create_index("ix_class_memberships_class_id", "class_memberships", ["class_id"])
    op.create_index("ix_class_memberships_user_id", "class_memberships", ["user_id"])

    # ------------------------------------------------------- class_messages
    op.create_table(
        "class_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "class_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shared_classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="message"),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_class_messages_class_id", "class_messages", ["class_id"])
    op.create_index("ix_class_messages_user_id", "class_messages", ["user_id"])

    # --------------------------------------------------------- class_events
    op.create_table(
        "class_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "class_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shared_classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("location", sa.String(200)),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True)),
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_class_events_class_id", "class_events", ["class_id"])
    op.create_index("ix_class_events_created_by", "class_events", ["created_by"])

    # ------------------------------- documents: archivos compartidos en clase
    op.add_column(
        "documents", sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_documents_class_id",
        "documents",
        "shared_classes",
        ["class_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_documents_class_id", "documents", ["class_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_class_id", table_name="documents")
    op.drop_constraint("fk_documents_class_id", "documents", type_="foreignkey")
    op.drop_column("documents", "class_id")

    op.drop_index("ix_class_events_created_by", table_name="class_events")
    op.drop_index("ix_class_events_class_id", table_name="class_events")
    op.drop_table("class_events")

    op.drop_index("ix_class_messages_user_id", table_name="class_messages")
    op.drop_index("ix_class_messages_class_id", table_name="class_messages")
    op.drop_table("class_messages")

    op.drop_index("ix_class_memberships_user_id", table_name="class_memberships")
    op.drop_index("ix_class_memberships_class_id", table_name="class_memberships")
    op.drop_table("class_memberships")

    op.drop_index("ix_shared_classes_owner_id", table_name="shared_classes")
    op.drop_index("ix_shared_classes_code", table_name="shared_classes")
    op.drop_table("shared_classes")
