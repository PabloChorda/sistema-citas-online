"""calendar: add CalendarBlackout table

Revision ID: 1b0b27556a91
Revises: a2d5152c6124
Create Date: 2025-09-16 08:43:59.996514
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b0b27556a91'
down_revision = 'a2d5152c6124'
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla principal
    op.create_table(
        'calendar_blackouts',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('establishment_id', sa.Integer(), sa.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('es_dia_completo', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('hora_inicio', sa.Time(), nullable=True),
        sa.Column('hora_fin', sa.Time(), nullable=True),
        sa.Column('nombre', sa.String(length=120), nullable=True),
        sa.Column('categoria', sa.String(length=50), nullable=True),
        sa.UniqueConstraint('establishment_id', 'fecha', 'es_dia_completo', name='uq_blackout_full_day'),
    )

    # Índice compuesto recomendado para queries por establecimiento + rango de fechas
    op.create_index(
        'ix_blackouts_establishment_date',
        'calendar_blackouts',
        ['establishment_id', 'fecha'],
        unique=False
    )

    # CHECK: si no es día completo, debe haber horas válidas (inicio < fin)
    op.create_check_constraint(
        'ck_blackout_partial_times',
        'calendar_blackouts',
        '(es_dia_completo = TRUE) OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_inicio < hora_fin)'
    )


def downgrade():
    # Revertir en orden inverso a lo creado
    op.drop_index('ix_blackouts_establishment_date', table_name='calendar_blackouts')
    op.drop_constraint('ck_blackout_partial_times', 'calendar_blackouts', type_='check')
    op.drop_table('calendar_blackouts')
