# backend/app/models/establishment.py
"""
Modelos para Establecimientos y el Personal asociado a ellos.
"""
from .. import db
from .base import BaseModel
from sqlalchemy.orm import validates
from sqlalchemy.dialects import postgresql

class Establishment(BaseModel):
    __tablename__ = 'establishments'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = db.Column(db.String(255), nullable=False)
    direccion_completa = db.Column(db.String(255), nullable=False)
    codigo_postal = db.Column(db.String(10), nullable=True)
    provincia = db.Column(db.String(100), nullable=False, index=True)
    localidad = db.Column(db.String(100), nullable=False, index=True)
    telefono = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    web = db.Column(db.String(255), nullable=True)
    abre_sabados = db.Column(db.Boolean, nullable=True)
    cierra_sabado = db.Column(db.Boolean, nullable=True)
    visible_en_busquedas = db.Column(db.Boolean, default=True)
    verificado = db.Column(db.Boolean, nullable=True)
    activo = db.Column(db.Boolean, default=True)
    descripcion_publica = db.Column(db.Text, nullable=True)
    slug = db.Column(db.String(255), unique=True, nullable=True, index=True)
    imagen_destacada = db.Column(db.String(255), nullable=True)
    url_map_embed = db.Column(db.String(255), nullable=True)
    tiene_acceso_discapacitados = db.Column(db.Boolean, nullable=True)
    aparcamiento_disponible = db.Column(db.Boolean, nullable=True)
    idiomas_hablados = db.Column(postgresql.ARRAY(db.String), nullable=True)
    horario_lunes_viernes = db.Column(db.String(100), nullable=True)
    horario_sabado = db.Column(db.String(100), nullable=True)

    # Relaciones
    provider = db.relationship('Provider', back_populates='establishments')
    services = db.relationship('Service', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary='establecimiento_tags', back_populates='establishments')
    availability_rules = db.relationship('AvailabilityRule', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    time_blocks = db.relationship('TimeBlock', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    staff_members = db.relationship('Staff', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    
    @validates('email')
    def validate_email(self, key, email):
        if email and '@' not in email:
            raise ValueError("El correo electrónico no es válido.")
        return email

    @validates('web')
    def validate_web(self, key, web):
        if web and not web.startswith(('http://', 'https://')):
            raise ValueError("La URL de la web debe empezar por http:// o https://.")
        return web

    def __repr__(self):
        return f'<Establishment ID {self.id}: {self.nombre} (Provider ID: {self.provider_id})>'
    
        # --- MÉTODO to_dict() AÑADIDO ---
    def to_dict(self):
        """Serializa el objeto Establishment a un diccionario."""
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'nombre': self.nombre,
            'direccion_completa': self.direccion_completa,
            'activo': self.activo,
            # Añade cualquier otro campo que quieras que esté disponible en el frontend
            **self.to_dict_base() # Incluye created_at y updated_at
        }

class Staff(BaseModel):
    __tablename__ = 'staff'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(100), nullable=False)
    email_contacto = db.Column(db.String(100), nullable=True)
    telefono_contacto = db.Column(db.String(50), nullable=True)
    imagen_perfil = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    visible_web = db.Column(db.Boolean, nullable=False, default=True)

    # Relación
    establishment = db.relationship('Establishment', back_populates='staff_members')

    @validates('email_contacto')
    def validate_email(self, key, email):
        if email and '@' not in email:
            raise ValueError("El correo electrónico del personal no es válido.")
        return email

    def __repr__(self):
        return f'<Staff ID {self.id} - {self.nombre} ({self.rol})>'

    def to_dict(self):
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'nombre': self.nombre,
            'rol': self.rol,
            'email_contacto': self.email_contacto,
            'telefono_contacto': self.telefono_contacto,
            'imagen_perfil': self.imagen_perfil,
            'bio': self.bio,
            'activo': self.activo,
            'visible_web': self.visible_web,
            **self.to_dict_base()
        }