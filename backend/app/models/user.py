# backend/app/models/user.py
"""
Modelos User y Provider para la gestión de usuarios, proveedores y autenticación.
"""
from .. import db
from .base import BaseModel
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.orm import validates
from sqlalchemy.dialects.postgresql import ARRAY

class User(BaseModel):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    social_id = db.Column(db.String(255), unique=True, nullable=True)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(50), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='client', index=True)
    email_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime(timezone=True), nullable=True)
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiry = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relaciones
    provider_profile = db.relationship('Provider', back_populates='user', uselist=False, lazy='joined', cascade="all, delete-orphan")
    appointments = db.relationship('Appointment', back_populates='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User ID {self.user_id}: {self.email} ({self.role})>'

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone_number': self.phone_number,
            'avatar_url': self.avatar_url,
            'role': self.role,
            'email_verified': self.email_verified,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            **self.to_dict_base()
        }

class Provider(BaseModel):
    __tablename__ = 'providers'

    # provider_id es A LA VEZ la Clave Primaria y la Clave Foránea.
    # Esto crea una relación 1 a 1 perfecta.
    provider_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)

    nombre_comercial = db.Column(db.String(255), nullable=False)
    cif = db.Column(db.String(20), nullable=False, unique=True, index=True)
    tipo_empresa = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    imagen_perfil_url = db.Column(db.String(255), nullable=True)
    telefono_contacto = db.Column(db.String(50), nullable=True)
    email_contacto = db.Column(db.String(100), nullable=True)
    web = db.Column(db.String(255), nullable=True)
    verificado = db.Column(db.Boolean, default=False, nullable=False, index=True)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    timezone = db.Column(db.String(50), nullable=True)
    idiomas_hablados = db.Column(ARRAY(db.String), nullable=True)
    direccion_fiscal = db.Column(db.String(255), nullable=True)

    # Relaciones
    user = db.relationship('User', back_populates='provider_profile')
    establishments = db.relationship('Establishment', back_populates='provider', lazy='dynamic', cascade="all, delete-orphan")

    @validates('email_contacto')
    def validate_email(self, key, email):
        if email and '@' not in email:
            raise ValueError("El correo de contacto no es válido.")
        return email

    @validates('web')
    def validate_web(self, key, web):
        if web and not web.startswith(('http://', 'https://')):
            raise ValueError("La URL debe comenzar con http:// o https://.")
        return web

    def __repr__(self):
        return f'<Provider ID {self.provider_id}: {self.nombre_comercial}>'

    def to_dict(self):
        user_info = self.user.to_dict() if self.user else {}
        return {
            'provider_id': self.provider_id,
            'user_id': self.provider_id, # Es el mismo valor
            'email': user_info.get('email'),
            'first_name': user_info.get('first_name'),
            'last_name': user_info.get('last_name'),
            'nombre_comercial': self.nombre_comercial,
            'cif': self.cif,
            'tipo_empresa': self.tipo_empresa,
            'bio': self.bio,
            'imagen_perfil_url': self.imagen_perfil_url,
            'telefono_contacto': self.telefono_contacto,
            'email_contacto': self.email_contacto,
            'web': self.web,
            'verificado': self.verificado,
            'activo': self.activo,
            'timezone': self.timezone,
            'idiomas_hablados': self.idiomas_hablados,
            'direccion_fiscal': self.direccion_fiscal,
            **self.to_dict_base()
        }