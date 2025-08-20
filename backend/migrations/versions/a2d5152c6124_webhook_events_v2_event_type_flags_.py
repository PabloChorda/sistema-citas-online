"""webhook_events v2: event_type + flags + indices

Revision ID: a2d5152c6124
Revises: 14840a4e8003
Create Date: 2025-08-20 17:38:21.985689

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2d5152c6124'
down_revision = '14840a4e8003'
branch_labels = None
depends_on = None


def upgrade():
    # 1) Cambios de esquema "seguros" (añadir columnas con default y nullable, índices, etc.)
    with op.batch_alter_table('webhook_events', schema=None) as batch_op:
        # Añadimos event_type inicialmente con server_default y nullable=True
        batch_op.add_column(sa.Column('event_type', sa.String(length=32), nullable=True, server_default='message'))
        batch_op.add_column(sa.Column('signature_valid', sa.Boolean(), nullable=True))

        # message_id: ampliar a 128
        batch_op.alter_column(
            'message_id',
            existing_type=sa.VARCHAR(length=100),
            type_=sa.String(length=128),
            existing_nullable=True
        )

        # sent_ok: permitir NULL
        batch_op.alter_column(
            'sent_ok',
            existing_type=sa.BOOLEAN(),
            nullable=True
        )

        # Índices: message_id único y combinado (from_msisdn, created_at)
        batch_op.drop_index('ix_webhook_events_message_id')
        batch_op.create_index(batch_op.f('ix_webhook_events_message_id'), ['message_id'], unique=True)
        batch_op.create_index('ix_webhook_events_sender_created', ['from_msisdn', 'created_at'], unique=False)

    # 2) Convertir keyword_detected de VARCHAR(32) -> BOOLEAN con USING
    op.execute("""
        ALTER TABLE webhook_events
        ALTER COLUMN keyword_detected
        TYPE boolean
        USING (
            CASE
                WHEN keyword_detected IS NULL THEN NULL
                WHEN lower(keyword_detected) IN ('true','t','1','yes','y') THEN true
                WHEN lower(keyword_detected) IN ('false','f','0','no','n') THEN false
                ELSE NULL
            END
        )
    """)

    # 3) Backfill y endurecer event_type
    op.execute("UPDATE webhook_events SET event_type='message' WHERE event_type IS NULL")

    with op.batch_alter_table('webhook_events', schema=None) as batch_op:
        # Hacer NOT NULL y quitar el server_default
        batch_op.alter_column('event_type', existing_type=sa.String(length=32), nullable=False)
        batch_op.alter_column('event_type', server_default=None)


def downgrade():
    # Revertir índices primero
    with op.batch_alter_table('webhook_events', schema=None) as batch_op:
        batch_op.drop_index('ix_webhook_events_sender_created')
        batch_op.drop_index(batch_op.f('ix_webhook_events_message_id'))
        batch_op.create_index('ix_webhook_events_message_id', ['message_id'], unique=False)

        # sent_ok vuelve a NOT NULL (como tenía antes del cambio)
        batch_op.alter_column('sent_ok', existing_type=sa.BOOLEAN(), nullable=False)

        # message_id vuelve a VARCHAR(100)
        batch_op.alter_column(
            'message_id',
            existing_type=sa.String(length=128),
            type_=sa.VARCHAR(length=100),
            existing_nullable=True
        )

        # Eliminar columnas nuevas
        batch_op.drop_column('signature_valid')
        batch_op.drop_column('event_type')

    # keyword_detected: volver a VARCHAR(32) desde boolean
    op.execute("""
        ALTER TABLE webhook_events
        ALTER COLUMN keyword_detected
        TYPE varchar(32)
        USING (
            CASE
                WHEN keyword_detected IS TRUE THEN 'true'
                WHEN keyword_detected IS FALSE THEN 'false'
                ELSE NULL
            END
        )
    """)
