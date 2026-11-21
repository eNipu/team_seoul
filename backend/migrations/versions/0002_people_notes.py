"""people notes: private notes about friends who aren't on Venn

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-21 18:28:38.331760

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "people",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("relationship", sa.String(length=80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "interests", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("people", schema=None) as batch_op:
        batch_op.create_index("ix_people_owner", ["owner_user_id"], unique=False)

    op.create_table(
        "person_interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.Column("activity", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("person_interactions", schema=None) as batch_op:
        batch_op.create_index("ix_person_interactions_person", ["person_id", "created_at"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("person_interactions", schema=None) as batch_op:
        batch_op.drop_index("ix_person_interactions_person")
    op.drop_table("person_interactions")
    with op.batch_alter_table("people", schema=None) as batch_op:
        batch_op.drop_index("ix_people_owner")
    op.drop_table("people")
