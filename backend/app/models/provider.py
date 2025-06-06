# backend/app/models/provider.py
"""
Modelo Provider - Perfiles de proveedores de servicios.
"""
from .. import db
from .base import BaseModel

class Provider(BaseModel):
    __tablename__ = 'providers'

    provider_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    business_name = db.Column(db.String(255), nullable=False)
    business_type = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')

    # Relaciones
    services_offered = db.relationship(
        'Service',
        backref=db.backref('provider', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    availability_rules = db.relationship(
        'AvailabilityRule',
        backref=db.backref('provider_rule_owner', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    time_blocks = db.relationship(
        'TimeBlock',
        backref=db.backref('provider_block_owner', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    provider_appointments = db.relationship(
        'Appointment',
        foreign_keys='Appointment.provider_id',
        backref=db.backref('provider_user_profile', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f'<Provider ID {self.provider_id}: {self.business_name}>'

    def to_dict(self):
        """Convierte el proveedor a diccionario incluyendo datos del usuario."""
        user_info = self.user.to_dict() if self.user else {}
        
        return {
            'provider_id': self.provider_id,
            'user_id': self.user.user_id if self.user else None,
            'email': user_info.get('email'),
            'first_name': user_info.get('first_name'),
            'last_name': user_info.get('last_name'),
            'phone_number': user_info.get('phone_number'),
            'business_name': self.business_name,
            'business_type': self.business_type,
            'address': self.address,
            'bio': self.bio,
            'profile_picture_url': self.profile_picture_url,
            'timezone': self.timezone,
            **self.to_dict_base()
        }