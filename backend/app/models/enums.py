# backend/app/models/enums.py
"""
Define los tipos ENUM personalizados para usar en los modelos.
"""
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

day_of_week_enum = PgEnum(
    'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO',
    name='dayofweektype_enum',
    create_type=False
)

appointment_status_enum = PgEnum(
    'PENDING_PROVIDER', 'CONFIRMED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER', 'COMPLETED', 'NO_SHOW',
    name='appointmentstatustype_enum',
    create_type=False
)