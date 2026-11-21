"""people imports (review before adding) and follow-ups (things to ask next time)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-21 19:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "people_imports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "items", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("source", sa.String(length=60), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("people_imports", schema=None) as batch_op:
        batch_op.create_index("ix_people_imports_user", ["user_id"], unique=False)

    op.create_table(
        "follow_ups",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=True),
        sa.Column("person_id", sa.Uuid(), nullable=True),
        sa.Column("text", sa.String(length=200), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "(connection_id IS NOT NULL AND person_id IS NULL) OR (connection_id IS NULL AND person_id IS NOT NULL)",
            name="ck_follow_ups_one_target",
        ),
        sa.ForeignKeyConstraint(["connection_id"], ["connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("follow_ups", schema=None) as batch_op:
        batch_op.create_index("ix_follow_ups_owner", ["owner_user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("follow_ups", schema=None) as batch_op:
        batch_op.drop_index("ix_follow_ups_owner")
    op.drop_table("follow_ups")
    with op.batch_alter_table("people_imports", schema=None) as batch_op:
        batch_op.drop_index("ix_people_imports_user")
    op.drop_table("people_imports")
