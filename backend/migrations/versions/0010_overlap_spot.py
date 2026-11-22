"""Record each participant's optional public meeting point confirmation."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "overlap_preferences", sa.Column("spot_confirmed", sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade() -> None:
    op.drop_column("overlap_preferences", "spot_confirmed")
