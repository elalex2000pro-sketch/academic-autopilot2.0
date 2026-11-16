"""Clasificacion opcional de notas sin reclasificar datos previos."""
from alembic import op
import sqlalchemy as sa

revision = "0028_grade_classification"
down_revision = "0027_task_snooze"
branch_labels = depends_on = None


def upgrade():
    op.add_column("grades", sa.Column("trimester", sa.Integer(), nullable=True))
    op.add_column("grades", sa.Column("unit", sa.String(80), nullable=True))


def downgrade():
    op.drop_column("grades", "unit")
    op.drop_column("grades", "trimester")
