"""plans, question links and responses, memories.people, people.is_sample

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-21 21:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ONE_TARGET = "(connection_id IS NOT NULL AND person_id IS NULL) OR (connection_id IS NULL AND person_id IS NOT NULL)"


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("memories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("people", _json(), nullable=True))
    with op.batch_alter_table("people", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_sample", sa.Boolean(), server_default=sa.false(), nullable=False))

    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("planned_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("plans", schema=None) as batch_op:
        batch_op.create_index("ix_plans_owner", ["owner_user_id"], unique=False)

    op.create_table(
        "plan_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=True),
        sa.Column("person_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(_ONE_TARGET, name="ck_plan_members_one_target"),
        sa.ForeignKeyConstraint(["connection_id"], ["connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("plan_members", schema=None) as batch_op:
        batch_op.create_index("ix_plan_members_plan", ["plan_id"], unique=False)

    op.create_table(
        "question_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=True),
        sa.Column("for_name", sa.String(length=80), nullable=True),
        sa.Column("max_responses", sa.Integer(), nullable=False),
        sa.Column("response_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["person_id"], ["people.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    with op.batch_alter_table("question_links", schema=None) as batch_op:
        batch_op.create_index("ix_question_links_owner", ["owner_user_id"], unique=False)

    op.create_table(
        "question_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("link_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("answers", _json(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["link_id"], ["question_links.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("question_responses", schema=None) as batch_op:
        batch_op.create_index("ix_question_responses_owner", ["owner_user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("question_responses", schema=None) as batch_op:
        batch_op.drop_index("ix_question_responses_owner")
    op.drop_table("question_responses")
    with op.batch_alter_table("question_links", schema=None) as batch_op:
        batch_op.drop_index("ix_question_links_owner")
    op.drop_table("question_links")
    with op.batch_alter_table("plan_members", schema=None) as batch_op:
        batch_op.drop_index("ix_plan_members_plan")
    op.drop_table("plan_members")
    with op.batch_alter_table("plans", schema=None) as batch_op:
        batch_op.drop_index("ix_plans_owner")
    op.drop_table("plans")
    with op.batch_alter_table("people", schema=None) as batch_op:
        batch_op.drop_column("is_sample")
    with op.batch_alter_table("memories", schema=None) as batch_op:
        batch_op.drop_column("people")
