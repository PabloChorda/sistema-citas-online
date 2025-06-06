# backend/app/models/appointment.py
"""
Modelo Appointment - Gestión de citas entre clientes y proveedores.
"""
from .. import db
from .base import BaseModel
from .enums import appointment_status_enum
from sqlalchemy.orm import validates

class Appointment(BaseModel):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True, index=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='SET NULL'), nullable=True, index=True)
    
    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    
    status = db.Column(
        appointment_status_enum,
        nullable=False,
        default='CONFIRMED',
        index=True
    )
    
    notes_client = db.Column(db.Text, nullable=True)
    notes_provider = db.Column(db.Text, nullable=True)

    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value):
        """Valida que start_datetime < end_datetime."""
        if key == 'start_datetime':
            if hasattr(self, 'end_datetime') and self.end_datetime is not None and value >= self.end_datetime:
                raise ValueError("La fecha/hora de inicio de la cita debe ser anterior a la fecha/hora de finalización.")
        elif key == 'end_datetime':
            if hasattr(self, 'start_datetime') and self.start_datetime is not None and value <= self.start_datetime:
                raise ValueError("La fecha/hora de finalización de la cita debe ser posterior a la fecha/hora de inicio.")
        return value

    def __repr__(self):
        status_val = self.status.value if hasattr(self.status, 'value') else self.status
        return f'<Appointment ID {self.id} for Service ID {self.service_id} at {self.start_datetime} ({status_val})>'

    def to_dict(self):
        """Convierte la cita a diccionario."""
        return {
            'id': self.id,
            'client_id': self.client_id,
            'provider_id': self.provider_id,
            'service_id': self.service_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'status': self.status.value if hasattr(self.status, 'value') else self.status,
            'notes_client': self.notes_client,
            'notes_provider': self.notes_provider,
            **self.to_dict_base()
        }