"""Herramientas de estudio: flashcards, examenes, enfoque, recordatorios y cuadernos compartidos.

Revision ID: 0011_learning_tools
Revises: 0010_notebooks
Create Date: 2026-10-20 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_learning_tools"
down_revision: str | None = "0010_notebooks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- Compartir cuadernos con una clase ---
    op.add_column(
        "notebooks", sa.Column("shared_class_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        "notebooks",
        sa.Column("share_permission", sa.String(10), nullable=False, server_default="read"),
    )
    op.create_foreign_key(
        "fk_notebooks_shared_class",
        "notebooks",
        "shared_classes",
        ["shared_class_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_notebooks_shared_class_id", "notebooks", ["shared_class_id"])

    # --- Flashcards ---
    op.create_table(
        "flashcards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "notebook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
        ),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("ease", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "due_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_flashcards_user_id", "flashcards", ["user_id"])
    op.create_index("ix_flashcards_notebook_id", "flashcards", ["notebook_id"])
    op.create_index("ix_flashcards_due_at", "flashcards", ["due_at"])

    # --- Examenes ---
    op.create_table(
        "quizzes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "notebook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="SET NULL"),
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("questions", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="ai"),
        sa.Column("score", sa.Integer()),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_quizzes_user_id", "quizzes", ["user_id"])
    op.create_index("ix_quizzes_notebook_id", "quizzes", ["notebook_id"])

    # --- Sesiones de enfoque ---
    op.create_table(
        "focus_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False, server_default="focus"),
        sa.Column(
            "finished_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_focus_sessions_user_id", "focus_sessions", ["user_id"])
    op.create_index("ix_focus_sessions_finished_at", "focus_sessions", ["finished_at"])

    # --- Recordatorios ---
    op.create_table(
        "reminder_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("telegram_chat_id", sa.String(64)),
        sa.Column("telegram_token_encrypted", sa.String(512)),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reminder_hour", sa.Integer(), nullable=False, server_default="19"),
        sa.Column("last_sent_on", sa.Date()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("reminder_settings")
    op.drop_index("ix_focus_sessions_finished_at", table_name="focus_sessions")
    op.drop_index("ix_focus_sessions_user_id", table_name="focus_sessions")
    op.drop_table("focus_sessions")
    op.drop_index("ix_quizzes_notebook_id", table_name="quizzes")
    op.drop_index("ix_quizzes_user_id", table_name="quizzes")
    op.drop_table("quizzes")
    op.drop_index("ix_flashcards_due_at", table_name="flashcards")
    op.drop_index("ix_flashcards_notebook_id", table_name="flashcards")
    op.drop_index("ix_flashcards_user_id", table_name="flashcards")
    op.drop_table("flashcards")
    op.drop_index("ix_notebooks_shared_class_id", table_name="notebooks")
    op.drop_constraint("fk_notebooks_shared_class", "notebooks", type_="foreignkey")
    op.drop_column("notebooks", "share_permission")
    op.drop_column("notebooks", "shared_class_id")
