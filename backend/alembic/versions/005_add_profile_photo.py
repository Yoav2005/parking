"""add profile_photo_url to users

Revision ID: 005
Revises: 004
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('profile_photo_url', sa.String(), nullable=True))

def downgrade():
    op.drop_column('users', 'profile_photo_url')
