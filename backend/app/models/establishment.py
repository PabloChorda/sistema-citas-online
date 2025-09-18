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
    provider_id = db.Column(
        db.Integer,
        db.ForeignKey('providers.provider_id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
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

    # ======= Auto-festivos (preferencias por establecimiento) =======
    # Nota: los defaults del modelo ayudan, pero añadiremos también server_default en la migración.
    holiday_auto_enabled   = db.Column(db.Boolean, nullable=False, default=False)
    holiday_country_code   = db.Column(db.String(2), nullable=False, default='ES')
    holiday_region_code    = db.Column(db.String(10), nullable=True)          # Ej: 'ES-VC'
    holiday_types          = db.Column(db.String(64), nullable=False, default='Public,Bank')
    holiday_years_ahead    = db.Column(db.Integer, nullable=False, default=1) # Año actual + N
    holiday_last_seed_year = db.Column(db.Integer, nullable=True)             # tracking opcional
    holiday_last_sync_at   = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relaciones
    provider = db.relationship('Provider', back_populates='establishments')
    services = db.relationship('Service', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary='establecimiento_tags', back_populates='establishments')
    availability_rules = db.relationship('AvailabilityRule', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    time_blocks = db.relationship('TimeBlock', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    staff_members = db.relationship('Staff', back_populates='establishment', lazy='dynamic', cascade="all, delete-orphan")
    # Opcional: acceso a blackouts desde el establecimiento
    calendar_blackouts = db.relationship('CalendarBlackout', backref='establishment', lazy='dynamic', cascade="all, delete-orphan")

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

    @validates('holiday_country_code')
    def validate_country(self, key, val):
        if val and len(val) != 2:
            raise ValueError("holiday_country_code debe ser un código ISO-3166-1 alpha-2 (2 letras).")
        return val.upper() if val else val

    def __repr__(self):
        return f'<Establishment ID {self.id}: {self.nombre} (Provider ID: {self.provider_id})>'

    # ===================== Serializadores =====================

    def to_public_dict(self):
        """Serialización segura para vistas públicas (marketplace/booking)."""
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
            'descripcion_publica': self.descripcion_publica,
            'web': self.web,
            'slug': self.slug,
            'imagen_destacada': self.imagen_destacada,
            'url_map_embed': self.url_map_embed,
            'tiene_acceso_discapacitados': self.tiene_acceso_discapacitados,
            'aparcamiento_disponible': self.aparcamiento_disponible,
            'visible_en_busquedas': self.visible_en_busquedas,
            'provider_info': provider_info,
            **self.to_dict_base()
        }

    def to_private_dict(self):
        """Serialización completa para el dashboard (autenticado)."""
        d = self.to_public_dict()
        d.update({
            'codigo_postal': self.codigo_postal,
            'telefono': self.telefono,
            'email': self.email,
            'horario_lunes_viernes': self.horario_lunes_viernes,
            'horario_sabado': self.horario_sabado,
            'idiomas_hablados': self.idiomas_hablados,
            'verificado': self.verificado,
            'abre_sabados': self.abre_sabados,
            'cierra_sabado': self.cierra_sabado,

            # Preferencias de auto-festivos (solo en privado)
            'holiday_auto_enabled': self.holiday_auto_enabled,
            'holiday_country_code': self.holiday_country_code,
            'holiday_region_code': self.holiday_region_code,
            'holiday_types': self.holiday_types,
            'holiday_years_ahead': self.holiday_years_ahead,
            'holiday_last_seed_year': self.holiday_last_seed_year,
            'holiday_last_sync_at': self.holiday_last_sync_at.isoformat() if self.holiday_last_sync_at else None,
        })
        return d

    # Compatibilidad si hay código antiguo que llama to_dict()
    def to_dict(self, include_private=True):
        return self.to_private_dict() if include_private else self.to_public_dict()


class Staff(BaseModel):
    __tablename__ = 'staff'

    id = db.Column(db.Integer, primary_key=True)

    # Un miembro del Staff ahora ES un Usuario en el sistema.
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.user_id', ondelete='CASCADE'),
        nullable=False,
        unique=True,
        index=True
    )

    establishment_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    rol = db.Column(db.String(100), nullable=False)  # Ej: "Estilista", "Terapeuta"
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
