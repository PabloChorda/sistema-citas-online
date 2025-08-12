"""magic links + phone_verified_at + unique phone

Revision ID: ba0420d02c55
Revises: b8dec5209111
Create Date: 2025-08-12 15:51:04.415738

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ba0420d02c55'
down_revision = 'b8dec5209111'
branch_labels = None
depends_on = None


def upgrade():
    # users: añadir phone_verified_at y UNIQUE(phone_number)
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_users_phone_number", "users", ["phone_number"])

    # magic_links: PK Integer, FK a users.user_id
    op.create_table(
        "magic_links",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_magic_links_token", "magic_links", ["token"], unique=True)
    op.create_index("ix_magic_links_user", "magic_links", ["user_id"])
    op.create_index("ix_magic_links_purpose", "magic_links", ["purpose"])
    op.create_index("ix_magic_links_expires", "magic_links", ["expires_at"])
    op.create_index("ix_magic_links_used", "magic_links", ["used_at"])

def downgrade():
    op.drop_index("ix_magic_links_used", table_name="magic_links")
    op.drop_index("ix_magic_links_expires", table_name="magic_links")
    op.drop_index("ix_magic_links_purpose", table_name="magic_links")
    op.drop_index("ix_magic_links_user", table_name="magic_links")
    op.drop_index("ix_magic_links_token", table_name="magic_links")
    op.drop_table("magic_links")

    op.drop_constraint("uq_users_phone_number", "users", type_="unique")
    op.drop_column("users", "phone_verified_at")