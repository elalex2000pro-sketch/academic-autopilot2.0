"""Entrega independiente del estado de la tarea; no reclasifica datos previos."""
from alembic import op
import sqlalchemy as sa

revision = "0026_task_delivery"
down_revision = "0025_office_documents"
branch_labels = depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("delivery_status", sa.String(16), server_default="none", nullable=False))
    op.add_column("tasks", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("delivery_note", sa.String(2000), nullable=True))
    op.add_column("tasks", sa.Column("delivery_url", sa.String(2048), nullable=True))
    op.add_column("tasks", sa.Column("delivery_previous_status", sa.String(16), nullable=True))


def downgrade():
    for name in ("delivery_previous_status", "delivery_url", "delivery_note", "delivered_at", "delivery_status"):
        op.drop_column("tasks", name)
