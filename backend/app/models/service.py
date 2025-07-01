# backend/app/models/service.py
"""
Modelo Service para los servicios ofrecidos por los establecimientos.
"""
from .. import db
from .base import BaseModel
from sqlalchemy import UniqueConstraint, Numeric
from sqlalchemy.orm import validates

class Service(BaseModel):
    __tablename__ = 'services'
    __table_args__ = (
        UniqueConstraint('establishment_id', 'nombre', name='uix_establishment_nombre'),
    )

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    duracion_minutos = db.Column(db.Integer, nullable=False)
    precio = db.Column(Numeric(10, 2), nullable=False)
    categoria = db.Column(db.String(100), nullable=True, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    orden = db.Column(db.Integer, nullable=True)
    requiere_confirmacion_manual = db.Column(db.Boolean, nullable=True)
    limite_reservas_diarias = db.Column(db.Integer, nullable=True)

    # Relaciones
    establishment = db.relationship('Establishment', back_populates='services')
    appointments = db.relationship('Appointment', back_populates='service', lazy='dynamic', cascade="save-update, merge")

    @validates('duracion_minutos')
    def validate_duracion(self, key, duracion):
        if not isinstance(duracion, int) or duracion <= 0:
            raise ValueError("La duración debe ser un entero positivo.")
        return duracion

    @validates('precio')
    def validate_precio(self, key, precio):
        if precio is None:
            raise ValueError("El precio es obligatorio.")
        try:
            precio_f = float(precio)
            if precio_f < 0:
                raise ValueError("El precio no puede ser negativo.")
        except (ValueError, TypeError):
            raise ValueError("El precio debe ser un número válido.")
        return precio

    @validates('limite_reservas_diarias')
    def validate_limite(self, key, limite):
        if limite is not None and (not isinstance(limite, int) or limite < 0):
            raise ValueError("El límite de reservas diarias debe ser un entero no negativo.")
        return limite

    def __repr__(self):
        return f'<Service ID {self.id}: {self.nombre} (Establishment ID: {self.establishment_id})>'

    def to_dict(self):
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'duracion_minutos': self.duracion_minutos,
            'precio': str(self.precio),
            'categoria': self.categoria,
            'is_active': self.is_active,
            'orden': self.orden,
            'requiere_confirmacion_manual': self.requiere_confirmacion_manual,
            'limite_reservas_diarias': self.limite_reservas_diarias,
            **self.to_dict_base()
        }