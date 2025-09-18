"""establishments: add auto-holidays settings

Revision ID: 02cbdb27e1bc
Revises: 1b0b27556a91
Create Date: 2025-09-17 10:34:58.287381

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '02cbdb27e1bc'
down_revision = '1b0b27556a91'
branch_labels = None
depends_on = None


def upgrade():
    # Añadimos server_default para evitar violaciones NOT NULL en filas existentes
    # y para alinear con los defaults del modelo.
    with op.batch_alter_table('establishments', schema=None) as batch_op:
        batch_op.add_column(sa.Column(
            'holiday_auto_enabled',
            sa.Boolean(),
            server_default=sa.text('FALSE'),
            nullable=False
        ))
        batch_op.add_column(sa.Column(
            'holiday_country_code',
            sa.String(length=2),
            server_default='ES',
            nullable=False
        ))
        batch_op.add_column(sa.Column(
            'holiday_region_code',
            sa.String(length=10),
            nullable=True
        ))
        batch_op.add_column(sa.Column(
            'holiday_types',
            sa.String(length=64),
            server_default='Public,Bank',
            nullable=False
        ))
        batch_op.add_column(sa.Column(
            'holiday_years_ahead',
            sa.Integer(),
            server_default='1',
            nullable=False
        ))
        batch_op.add_column(sa.Column(
            'holiday_last_seed_year',
            sa.Integer(),
            nullable=True
        ))
        batch_op.add_column(sa.Column(
            'holiday_last_sync_at',
            sa.DateTime(timezone=True),
            nullable=True
        ))

    # Nota: si quisieras quitar los server_default tras poblar (no es obligatorio),
    # podrías hacer un ALTER posterior para dejar sólo los defaults de aplicación.


def downgrade():
    with op.batch_alter_table('establishments', schema=None) as batch_op:
        batch_op.drop_column('holiday_last_sync_at')
        batch_op.drop_column('holiday_last_seed_year')
        batch_op.drop_column('holiday_years_ahead')
        batch_op.drop_column('holiday_types')
        batch_op.drop_column('holiday_region_code')
        batch_op.drop_column('holiday_country_code')
        batch_op.drop_column('holiday_auto_enabled')
