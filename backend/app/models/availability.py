# backend/app/models/availability.py
"""
Modelos de disponibilidad - AvailabilityRule y TimeBlock.
Gestiona las reglas de disponibilidad y bloques de tiempo específicos.
"""
from .. import db
from .base import BaseModel
from .enums import day_of_week_enum
from sqlalchemy.orm import validates

class AvailabilityRule(BaseModel):
    """Reglas de disponibilidad recurrentes por día de la semana."""
    __tablename__ = 'availability_rules'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    day_of_week = db.Column(day_of_week_enum, nullable=False)
    start_time = db.Column(db.Time(timezone=False), nullable=False)
    end_time = db.Column(db.Time(timezone=False), nullable=False)

    @validates('start_time', 'end_time')
    def validate_time_range(self, key, value):
        """Valida que start_time < end_time."""
        if key == 'start_time':
            if hasattr(self, 'end_time') and self.end_time is not None and value >= self.end_time:
                raise ValueError("La hora de inicio debe ser anterior a la hora de finalización.")
        elif key == 'end_time':
            if hasattr(self, 'start_time') and self.start_time is not None and value <= self.start_time:
                raise ValueError("La hora de finalización debe ser posterior a la hora de inicio.")
        return value

    def __repr__(self):
        return f'<AvailabilityRule for Provider ID {self.provider_id} on day {self.day_of_week} from {self.start_time} to {self.end_time}>'

    def to_dict(self):
        """Convierte la regla de disponibilidad a diccionario."""
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'day_of_week': self.day_of_week,
            'start_time': self.start_time.strftime('%H:%M:%S'),
            'end_time': self.end_time.strftime('%H:%M:%S'),
            **self.to_dict_base()
        }


class TimeBlock(BaseModel):
    """Bloques de tiempo específicos para excepciones en la disponibilidad."""
    __tablename__ = 'time_blocks'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    is_available = db.Column(db.Boolean, nullable=False, default=False)  # False = no disponible, True = disponible extra
    reason = db.Column(db.String(255), nullable=True)

    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value):
        """Valida que start_datetime < end_datetime."""
        if key == 'start_datetime':
            if hasattr(self, 'end_datetime') and self.end_datetime is not None and value >= self.end_datetime:
                raise ValueError("La fecha/hora de inicio debe ser anterior a la fecha/hora de finalización.")
        elif key == 'end_datetime':
            if hasattr(self, 'start_datetime') and self.start_datetime is not None and value <= self.start_datetime:
                raise ValueError("La fecha/hora de finalización debe ser posterior a la fecha/hora de inicio.")
        return value

    def __repr__(self):
        availability_status = "available" if self.is_available else "unavailable"
        return f'<TimeBlock for Provider ID {self.provider_id} from {self.start_datetime} to {self.end_datetime} ({availability_status})>'

    def to_dict(self):
        """Convierte el bloque de tiempo a diccionario."""
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'is_available': self.is_available,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }