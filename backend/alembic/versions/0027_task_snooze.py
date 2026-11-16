"""Recordatorio independiente del plazo escolar; registro diario de avisos."""
from alembic import op
import sqlalchemy as sa

revision = "0027_task_snooze"
down_revision = "0026_task_delivery"
branch_labels = depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("overdue_prompted_on", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("tasks", "overdue_prompted_on")
    op.drop_column("tasks", "snoozed_until")
