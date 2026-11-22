"""Track confirmed platform imports and explicit interest lookups.

Do not guess the provenance of existing notes from names or consumed proposals.
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("people", sa.Column("import_platform", sa.String(16)))
    op.add_column("users", sa.Column("matches_reviewed_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "matches_reviewed_at")
    op.drop_column("people", "import_platform")
