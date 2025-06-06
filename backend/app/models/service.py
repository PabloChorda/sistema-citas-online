# backend/app/models/service.py
"""
Modelo Service - Servicios ofrecidos por los proveedores.
"""
from .. import db
from .base import BaseModel
from sqlalchemy.orm import validates

class Service(BaseModel):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Relaciones
    appointments_for_service = db.relationship(
        'Appointment',
        backref=db.backref('service_booked', lazy='joined'),
        lazy='dynamic',
        cascade="save-update, merge"  # Mantener citas si se borra servicio
    )

    @validates('duration_minutes')
    def validate_duration(self, key, duration):
        """Valida que la duración sea un entero positivo."""
        if not isinstance(duration, int) or duration <= 0:
            raise ValueError("La duración del servicio debe ser un entero positivo.")
        return duration
    
    @validates('price')
    def validate_price(self, key, price):
        """Valida que el precio sea válido y no negativo."""
        if price is not None:
            try:
                price_float = float(price)
                if price_float < 0:
                    raise ValueError("El precio no puede ser negativo.")
            except (ValueError, TypeError):
                raise ValueError("El precio debe ser un número válido.")
        return price

    def __repr__(self):
        return f'<Service ID {self.id}: {self.name} (Provider ID: {self.provider_id})>'

    def to_dict(self):
        """Convierte el servicio a diccionario."""
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'name': self.name,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'price': str(self.price) if self.price is not None else None,
            'is_active': self.is_active,
            **self.to_dict_base()
        }