"""Biblioteca privada de Office e historial."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
revision = "0025_office_documents"
down_revision = "0024_notebook_ai"
branch_labels = depends_on = None

def upgrade():
    timestamps = lambda: [sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)]
    op.create_table("office_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False), sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False), sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False), sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("folder", sa.String(100)), sa.Column("import_key", sa.String(100)),
        *timestamps(), sa.UniqueConstraint("user_id", "import_key"))
    op.create_index("ix_office_documents_user_id", "office_documents", ["user_id"])
    op.create_table("office_document_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("office_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False), sa.Column("snapshot", sa.JSON(), nullable=False),
        *timestamps(), sa.UniqueConstraint("document_id", "revision"))
    op.create_index("ix_office_document_versions_document_id", "office_document_versions", ["document_id"])

def downgrade():
    op.drop_table("office_document_versions")
    op.drop_table("office_documents")
