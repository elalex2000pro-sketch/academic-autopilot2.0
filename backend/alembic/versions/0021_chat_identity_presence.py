"""Public handles for every account, last seen and recipient delivery watermarks.

Revision ID: 0021_chat_identity_presence
Revises: 0020_user_verification
"""

import hashlib
import re

import sqlalchemy as sa

from alembic import op

revision = "0021_chat_identity_presence"
down_revision = "0020_user_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, username FROM users ORDER BY id")).all()
    used: set[str] = set()
    replacements = []
    for user_id, original in rows:
        clean = (original or "").strip().lstrip("@").lower()
        attempt = 0
        if not re.fullmatch(r"[a-z0-9_]{3,24}", clean) or clean in used:
            clean = ""
        while not clean or clean in used:
            clean = "user_" + hashlib.sha256(f"{user_id}:{attempt}".encode()).hexdigest()[:19]
            attempt += 1
        used.add(clean)
        if original != clean:
            replacements.append((user_id, clean))
    # Two passes avoid transient conflicts when normalizing mixed-case names.
    occupied = {name for _, name in rows}
    for user_id, _ in replacements:
        attempt = 0
        temporary = ""
        while not temporary or temporary in occupied:
            temporary = (
                "~" + hashlib.sha256(f"{user_id}:temporary:{attempt}".encode()).hexdigest()[:23]
            )
            attempt += 1
        occupied.add(temporary)
        connection.execute(
            sa.text("UPDATE users SET username = :name WHERE id = :id"),
            {"name": temporary, "id": user_id},
        )
    for user_id, name in replacements:
        connection.execute(
            sa.text("UPDATE users SET username = :name WHERE id = :id"),
            {"name": name, "id": user_id},
        )
    op.alter_column("users", "username", existing_type=sa.String(24), nullable=False)
    op.create_index("uq_users_username_lower", "users", [sa.text("lower(username)")], unique=True)
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True)))
    op.add_column("chat_members", sa.Column("last_delivered_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("chat_members", "last_delivered_at")
    op.drop_column("users", "last_seen_at")
    op.drop_index("uq_users_username_lower", table_name="users")
    op.alter_column("users", "username", existing_type=sa.String(24), nullable=True)
