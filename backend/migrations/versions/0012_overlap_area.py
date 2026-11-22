"""Store a private account-level Overlap neighborhood."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("overlap_area", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "overlap_area")
