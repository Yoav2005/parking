"""add car fields to users and chat_messages table

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("car_make", sa.String(), nullable=True))
    op.add_column("users", sa.Column("car_model", sa.String(), nullable=True))

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("reservation_id", sa.String(), sa.ForeignKey("reservations.id"), nullable=False, index=True),
        sa.Column("sender_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_column("users", "car_model")
    op.drop_column("users", "car_make")
