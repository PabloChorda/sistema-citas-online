# backend/app/models/user.py
"""
Modelo User - Gestión de usuarios y autenticación.
"""
from .. import db
from .base import BaseModel
from werkzeug.security import generate_password_hash, check_password_hash

class User(BaseModel):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='client', index=True)  # 'client', 'provider'

    # Relaciones
    provider_profile = db.relationship(
        'Provider',
        backref=db.backref('user', uselist=False, lazy='joined'),
        uselist=False,
        cascade="all, delete-orphan"
    )

    client_appointments = db.relationship(
        'Appointment',
        foreign_keys='Appointment.client_id',
        backref=db.backref('client_user', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    def set_password(self, password):
        """Establece el hash de la contraseña."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifica la contraseña."""
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User ID {self.user_id}: {self.email} ({self.role})>'

    def to_dict(self, include_profile=False):
        """Convierte el usuario a diccionario."""
        data = {
            'user_id': self.user_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone_number': self.phone_number,
            'role': self.role,
            **self.to_dict_base()
        }
        
        if self.role == 'provider' and include_profile and self.provider_profile:
            data['provider_profile'] = self.provider_profile.to_dict()
            
        return data