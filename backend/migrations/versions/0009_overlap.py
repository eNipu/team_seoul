"""Opt-in overlap windows, anonymous matches, and pair exclusions.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "overlap_matches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("interest", sa.String(64), nullable=False),
    )
    op.create_table(
        "overlap_preferences",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("area", sa.String(64), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("slot", sa.String(32), nullable=False),
        sa.Column("interests", sa.JSON().with_variant(JSONB(), "postgresql"), nullable=False),
        sa.Column("adults_confirmed", sa.Boolean(), nullable=False),
        sa.Column("match_id", sa.Uuid(), sa.ForeignKey("overlap_matches.id", ondelete="SET NULL")),
        sa.Column("accepted", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_overlap_preferences_window", "overlap_preferences", ["area", "date", "slot"])
    op.create_table(
        "overlap_exclusions",
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("other_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('pass', 'block', 'report')", name="ck_overlap_exclusions_kind"),
    )


def downgrade() -> None:
    op.drop_table("overlap_exclusions")
    op.drop_table("overlap_preferences")
    op.drop_table("overlap_matches")
