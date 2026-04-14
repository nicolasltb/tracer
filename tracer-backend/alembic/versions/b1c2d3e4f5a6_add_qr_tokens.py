"""add qr_tokens table

Revision ID: b1c2d3e4f5a6
Revises: 4aa9f4500e18
Create Date: 2026-04-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "4aa9f4500e18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Referencia os tipos enum já existentes — não os cria novamente
batch_status = ENUM(name="batch_status", create_type=False)
user_role = ENUM(name="user_role", create_type=False)


def upgrade() -> None:
    op.create_table(
        "qr_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("next_status", batch_status, nullable=True),
        sa.Column("expected_role", user_role, nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_consumer", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"]),
        sa.ForeignKeyConstraint(["used_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_qr_tokens_batch_id"), "qr_tokens", ["batch_id"], unique=False)
    op.create_index(op.f("ix_qr_tokens_token"), "qr_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_qr_tokens_token"), table_name="qr_tokens")
    op.drop_index(op.f("ix_qr_tokens_batch_id"), table_name="qr_tokens")
    op.drop_table("qr_tokens")
