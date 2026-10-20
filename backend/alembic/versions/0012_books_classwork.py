"""Biblioteca de libros completos y trabajo de clase.

Revision ID: 0012_books_classwork
Revises: 0011_learning_tools
Create Date: 2026-10-20 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0012_books_classwork"
down_revision: str | None = "0011_learning_tools"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- Biblioteca de libros ---
    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("courses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(300), nullable=True),
        sa.Column("format", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("cover_color", sa.String(20), nullable=False, server_default="#6366f1"),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("total_sections", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_section_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_filename", sa.String(500), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_books_user_id", "books", ["user_id"])
    op.create_index("ix_books_course_id", "books", ["course_id"])
    op.create_index("ix_books_document_id", "books", ["document_id"])

    op.create_table(
        "book_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("char_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("book_id", "section_index", name="uq_book_section_index"),
    )
    op.create_index("ix_book_sections_book_id", "book_sections", ["book_id"])

    op.create_table(
        "book_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(20), nullable=False, server_default="ai"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_book_messages_book_id", "book_messages", ["book_id"])
    op.create_index("ix_book_messages_user_id", "book_messages", ["user_id"])

    # --- Fuentes elegidas para un cuaderno (libros o archivos) ---
    op.create_table(
        "notebook_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "notebook_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "added_by",
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
        sa.UniqueConstraint("notebook_id", "book_id", name="uq_notebook_source_book"),
        sa.UniqueConstraint("notebook_id", "document_id", name="uq_notebook_source_document"),
    )
    op.create_index("ix_notebook_sources_notebook_id", "notebook_sources", ["notebook_id"])
    op.create_index("ix_notebook_sources_book_id", "notebook_sources", ["book_id"])
    op.create_index("ix_notebook_sources_document_id", "notebook_sources", ["document_id"])
    op.create_index("ix_notebook_sources_added_by", "notebook_sources", ["added_by"])

    # --- Trabajo de clase (estilo Classroom) ---
    op.create_table(
        "class_assignments",
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
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_class_assignments_class_id", "class_assignments", ["class_id"])
    op.create_index("ix_class_assignments_created_by", "class_assignments", ["created_by"])

    op.create_table(
        "class_assignment_completions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("class_assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
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
        sa.UniqueConstraint("assignment_id", "user_id", name="uq_assignment_completion"),
    )
    op.create_index(
        "ix_class_assignment_completions_assignment_id",
        "class_assignment_completions",
        ["assignment_id"],
    )
    op.create_index(
        "ix_class_assignment_completions_user_id",
        "class_assignment_completions",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_class_assignment_completions_user_id",
        table_name="class_assignment_completions",
    )
    op.drop_index(
        "ix_class_assignment_completions_assignment_id",
        table_name="class_assignment_completions",
    )
    op.drop_table("class_assignment_completions")
    op.drop_index("ix_class_assignments_created_by", table_name="class_assignments")
    op.drop_index("ix_class_assignments_class_id", table_name="class_assignments")
    op.drop_table("class_assignments")

    op.drop_index("ix_book_messages_user_id", table_name="book_messages")
    op.drop_index("ix_book_messages_book_id", table_name="book_messages")
    op.drop_table("book_messages")
    op.drop_index("ix_notebook_sources_added_by", table_name="notebook_sources")
    op.drop_index("ix_notebook_sources_document_id", table_name="notebook_sources")
    op.drop_index("ix_notebook_sources_book_id", table_name="notebook_sources")
    op.drop_index("ix_notebook_sources_notebook_id", table_name="notebook_sources")
    op.drop_table("notebook_sources")
    op.drop_index("ix_book_sections_book_id", table_name="book_sections")
    op.drop_table("book_sections")
    op.drop_index("ix_books_document_id", table_name="books")
    op.drop_index("ix_books_course_id", table_name="books")
    op.drop_index("ix_books_user_id", table_name="books")
    op.drop_table("books")
