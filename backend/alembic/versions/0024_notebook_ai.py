"""Historial y acciones de la IA de cuadernos."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0024_notebook_ai"
down_revision = "0023_class_message_replies"
branch_labels = depends_on = None


def upgrade():
    for table, fields in [
        ("notebook_messages", [sa.Column("role", sa.String(16), nullable=False), sa.Column("content", sa.Text(), nullable=False), sa.Column("citations", JSONB, nullable=False), sa.Column("actions", JSONB, nullable=False)]),
        ("notebook_actions", [sa.Column("tool", sa.String(60), nullable=False), sa.Column("arguments_summary", JSONB, nullable=False), sa.Column("result", JSONB, nullable=False)]),
    ]:
        op.create_table(table,
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("notebook_id", UUID(as_uuid=True), sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            *fields)
        for field in ("notebook_id", "user_id"):
            op.create_index(f"ix_{table}_{field}", table, [field])


def downgrade():
    op.drop_table("notebook_actions")
    op.drop_table("notebook_messages")
