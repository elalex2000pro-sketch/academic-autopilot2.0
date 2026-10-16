"""Gestion academica manual: grades y timetable_entries.

Revision ID: 0002_manual_management
Revises: 0001_initial
Create Date: 2026-02-01 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_manual_management"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -------------------------------------------------------------- grades
    op.create_table(
        "grades",
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
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("score", sa.Float()),
        sa.Column("max_score", sa.Float(), nullable=False, server_default="10"),
        sa.Column("weight", sa.Float()),
        sa.Column("graded_at", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_grades_user_id", "grades", ["user_id"])
    op.create_index("ix_grades_course_id", "grades", ["course_id"])

    # --------------------------------------------------- timetable_entries
    op.create_table(
        "timetable_entries",
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
        ),
        sa.Column("title", sa.String(300)),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("location", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_timetable_entries_user_id", "timetable_entries", ["user_id"])
    op.create_index("ix_timetable_entries_course_id", "timetable_entries", ["course_id"])
    op.create_index("ix_timetable_user_day", "timetable_entries", ["user_id", "day_of_week"])


def downgrade() -> None:
    op.drop_table("timetable_entries")
    op.drop_table("grades")
