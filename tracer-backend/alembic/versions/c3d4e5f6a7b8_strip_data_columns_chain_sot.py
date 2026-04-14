"""strip data columns from batches/events — chain is source of truth

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-04-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- batches: drop data columns (chain stores these) ---
    op.drop_column("batches", "coffee_type")
    op.drop_column("batches", "weight_kg")
    op.drop_column("batches", "origin_farm")
    op.drop_column("batches", "origin_city")
    op.drop_column("batches", "origin_state")
    op.drop_column("batches", "harvest_date")
    op.drop_column("batches", "description")

    # --- batch_events: drop data columns (chain stores these) ---
    op.drop_column("batch_events", "location")
    op.drop_column("batch_events", "latitude")
    op.drop_column("batch_events", "longitude")
    op.drop_column("batch_events", "metadata_json")
    op.drop_column("batch_events", "notes")


def downgrade() -> None:
    # --- batch_events: restore columns ---
    op.add_column("batch_events", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("batch_events", sa.Column("metadata_json", postgresql.JSONB(), nullable=True))
    op.add_column("batch_events", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("batch_events", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("batch_events", sa.Column("location", sa.String(255), nullable=True))

    # --- batches: restore columns ---
    op.add_column("batches", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("batches", sa.Column("harvest_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("batches", sa.Column("origin_state", sa.String(2), nullable=True))
    op.add_column("batches", sa.Column("origin_city", sa.String(255), nullable=True))
    op.add_column("batches", sa.Column("origin_farm", sa.String(255), nullable=True))
    op.add_column("batches", sa.Column("weight_kg", sa.Numeric(10, 3), nullable=True))
    op.add_column("batches", sa.Column("coffee_type", sa.Enum("arabica", "robusta", "blend", name="coffee_type"), nullable=True))
