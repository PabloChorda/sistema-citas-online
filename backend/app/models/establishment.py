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
    # Flag para activar la lógica de múltiples miembros de staff.
    has_multiple_staff = db.Column(db.Boolean, default=False, nullable=False)
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
    
    def to_dict(self):
        """Serializa el objeto Establishment a un diccionario."""
        provider_info = self.provider.to_dict(include_establishments=False) if self.provider else None
        
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'nombre': self.nombre,
            'direccion_completa': self.direccion_completa,
            'provincia': self.provincia,
            'localidad': self.localidad,
            'activo': self.activo,
            'has_multiple_staff': self.has_multiple_staff,
            'provider_info': provider_info,
            **self.to_dict_base()
        }

class Staff(BaseModel):
    __tablename__ = 'staff'

    id = db.Column(db.Integer, primary_key=True)
    
    # Un miembro del Staff ahora ES un Usuario en el sistema.
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    establishment_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    
    rol = db.Column(db.String(100), nullable=False) # Ej: "Estilista", "Terapeuta"
    bio = db.Column(db.Text, nullable=True)
    imagen_perfil = db.Column(db.String(255), nullable=True)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    
    # Relaciones
    establishment = db.relationship('Establishment', back_populates='staff_members')
    user = db.relationship('User', backref=db.backref('staff_profile', uselist=False, lazy='joined'))
    services = db.relationship('Service', secondary='staff_services', back_populates='staff_members')

    def __repr__(self):
        user_name = f"{self.user.first_name}" if self.user and self.user.first_name else f"User ID {self.user_id}"
        return f'<Staff ID {self.id}: {user_name} ({self.rol})>'

    def to_dict(self):
        user_info = self.user.to_dict() if self.user else {}
        
        try:
            service_ids_list = [service.id for service in self.services]
        except Exception:
            service_ids_list = []

        return {
            'id': self.id,
            'user_id': self.user_id,
            'establishment_id': self.establishment_id,
            'first_name': user_info.get('first_name'),
            'last_name': user_info.get('last_name'),
            'email': user_info.get('email'),
            'rol': self.rol,
            'bio': self.bio,
            'imagen_perfil': user_info.get('avatar_url') or self.imagen_perfil,
            'activo': self.activo,
            'service_ids': service_ids_list,
            **self.to_dict_base()
        }