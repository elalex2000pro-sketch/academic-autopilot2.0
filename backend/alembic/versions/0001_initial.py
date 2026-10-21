"""Esquema inicial: users, integrations, courses, tasks, schedule_blocks, sync_logs.

Revision ID: 0001_initial
Revises:
Create Date: 2026-01-01 00:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Definiciones de ENUM nativos reutilizables.
source_platform = postgresql.ENUM(
    "moodle", "google_classroom", "manual", name="source_platform", create_type=False
)
provider_enum = postgresql.ENUM(
    "moodle", "google_classroom", "all", name="provider", create_type=False
)
integration_status = postgresql.ENUM(
    "connected", "error", "disabled", name="integration_status", create_type=False
)
task_priority = postgresql.ENUM(
    "urgent", "long_project", "short_task", name="task_priority", create_type=False
)
task_status = postgresql.ENUM(
    "pending", "in_progress", "completed", "archived", name="task_status", create_type=False
)
sync_status = postgresql.ENUM(
    "success", "partial", "error", name="sync_status", create_type=False
)

_ALL_ENUMS = (
    source_platform,
    provider_enum,
    integration_status,
    task_priority,
    task_status,
    sync_status,
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in _ALL_ENUMS:
        enum.create(bind, checkfirst=True)

    # -------------------------------------------------------------- users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200)),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # -------------------------------------------------------- integrations
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", provider_enum, nullable=False),
        sa.Column("status", integration_status, nullable=False, server_default="connected"),
        sa.Column("base_url", sa.String(500)),
        sa.Column("token_enc", sa.String(4096)),
        sa.Column("refresh_token_enc", sa.String(4096)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("meta", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "provider", name="uq_integration_user_provider"),
    )
    op.create_index("ix_integrations_user_id", "integrations", ["user_id"])

    # ------------------------------------------------------------- courses
    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", source_platform, nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("code", sa.String(120)),
        sa.Column("color", sa.String(16)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "source", "external_id", name="uq_course_user_source_ext"),
    )
    op.create_index("ix_courses_user_id", "courses", ["user_id"])

    # --------------------------------------------------------------- tasks
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="SET NULL")),
        sa.Column("source", source_platform, nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("priority", task_priority, nullable=False, server_default="short_task"),
        sa.Column("status", task_status, nullable=False, server_default="pending"),
        sa.Column("target_start_at", sa.DateTime(timezone=True)),
        sa.Column("target_end_at", sa.DateTime(timezone=True)),
        sa.Column("parent_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "source", "external_id", name="uq_task_user_source_ext"),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_course_id", "tasks", ["course_id"])
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])
    op.create_index("ix_tasks_due_at", "tasks", ["due_at"])
    op.create_index("ix_task_user_status", "tasks", ["user_id", "status"])
    op.create_index("ix_task_user_target_start", "tasks", ["user_id", "target_start_at"])

    # ----------------------------------------------------- schedule_blocks
    op.create_table(
        "schedule_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("label", sa.String(120)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_schedule_blocks_user_id", "schedule_blocks", ["user_id"])
    op.create_index("ix_schedule_user_day", "schedule_blocks", ["user_id", "day_of_week"])

    # ----------------------------------------------------------- sync_logs
    op.create_table(
        "sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", provider_enum, nullable=False),
        sa.Column("status", sync_status, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("removed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text()),
        sa.Column("errors", postgresql.JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sync_logs_user_id", "sync_logs", ["user_id"])
    op.create_index("ix_synclog_user_started", "sync_logs", ["user_id", sa.text("started_at DESC")])


def downgrade() -> None:
    op.drop_table("sync_logs")
    op.drop_table("schedule_blocks")
    op.drop_table("tasks")
    op.drop_table("courses")
    op.drop_table("integrations")
    op.drop_table("users")
    for enum in reversed(_ALL_ENUMS):
        enum.drop(op.get_bind(), checkfirst=True)
