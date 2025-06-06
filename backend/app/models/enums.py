# backend/app/models/enums.py
"""
Definiciones de ENUMs para la aplicación.
Centraliza todos los tipos enumerados utilizados en los modelos.
"""
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

# ENUM para días de la semana
day_of_week_enum = PgEnum(
    'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO',
    name='dayofweektype_enum',
    create_type=False  # Alembic gestionará la creación del tipo
)

# ENUM para estados de citas
appointment_status_enum = PgEnum(
    'PENDING_PROVIDER', 'CONFIRMED', 'CANCELLED_BY_CLIENT', 
    'CANCELLED_BY_PROVIDER', 'COMPLETED', 'NO_SHOW',
    name='appointmentstatustype_enum',
    create_type=False  # Alembic gestionará la creación del tipo
)