"""initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("stripe_account_id", sa.String(), nullable=True),
        sa.Column("avg_rating", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "spots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("leaver_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.String(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("AVAILABLE", "RESERVED", "COMPLETED", "CANCELLED", "EXPIRED", name="spotstatus"),
            nullable=False,
            server_default="AVAILABLE",
        ),
        sa.Column("leaving_in_minutes", sa.Integer(), nullable=False),
        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_spots_leaver_id", "spots", ["leaver_id"])
    op.create_index("ix_spots_status", "spots", ["status"])
    op.create_index("ix_spots_geo", "spots", ["status", "latitude", "longitude"])

    op.create_table(
        "reservations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("spot_id", sa.String(), sa.ForeignKey("spots.id"), nullable=False),
        sa.Column("driver_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "REFUNDED", name="reservationstatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("arrival_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_cancel_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_reservations_spot_id", "reservations", ["spot_id"])
    op.create_index("ix_reservations_driver_id", "reservations", ["driver_id"])

    op.create_table(
        "ratings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("reservation_id", sa.String(), sa.ForeignKey("reservations.id"), nullable=False),
        sa.Column("rater_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("rated_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ratings_reservation_id", "ratings", ["reservation_id"])


def downgrade() -> None:
    op.drop_table("ratings")
    op.drop_table("reservations")
    op.drop_table("spots")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS spotstatus")
    op.execute("DROP TYPE IF EXISTS reservationstatus")
