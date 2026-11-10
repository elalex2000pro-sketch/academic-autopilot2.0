"""Respuestas a publicaciones de compañeros."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision="0023_class_message_replies"
down_revision="0022_peer_classwork"
branch_labels=None
depends_on=None

def upgrade():
    op.add_column("class_messages",sa.Column("parent_id",UUID(as_uuid=True),nullable=True))
    op.create_foreign_key("fk_class_message_parent","class_messages","class_messages",["parent_id"],["id"],ondelete="CASCADE")
    op.create_index("ix_class_messages_parent_id","class_messages",["parent_id"])

def downgrade():
    op.drop_index("ix_class_messages_parent_id",table_name="class_messages")
    op.drop_constraint("fk_class_message_parent","class_messages",type_="foreignkey")
    op.drop_column("class_messages","parent_id")
