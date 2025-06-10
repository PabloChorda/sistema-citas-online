# backend/app/models.py
from . import db # Importa la instancia db desde app/__init__.py
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.sql import func # Para server_default=func.now()
from sqlalchemy.orm import validates # Para validaciones
from sqlalchemy.dialects.postgresql import ENUM as PgEnum # Para enums en PostgreSQL
from sqlalchemy.dialects import postgresql
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import validates
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ARRAY


# --- ENUM Definitions (these must be created in the database via Alembic migrations) ---
# SG: Es buena práctica definir los enums una vez aquí y luego referenciarlos.
# SG: El nombre que le das al PgEnum (ej. 'dayofweektype_enum') es el nombre que PostgreSQL usará internamente para el tipo.
# SG: Es importante que este nombre sea único en tu base de datos para todos los tipos ENUM.

day_of_week_enum = PgEnum(
    'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO',
    name='dayofweektype_enum', # SG: Nombre para el tipo ENUM en PostgreSQL
    create_type=False # SG: Le decimos a SQLAlchemy que no intente crear el tipo él mismo; Alembic lo hará.
)

appointment_status_enum = PgEnum(
    'PENDING_PROVIDER', 'CONFIRMED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER', 'COMPLETED', 'NO_SHOW',
    name='appointmentstatustype_enum', # SG: Nombre para el tipo ENUM en PostgreSQL
    create_type=False # SG: Alembic gestionará la creación del tipo.
)

# --- Modelos ---

class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)  # Puede ser null para social login
    social_id = db.Column(db.String(255), unique=True, nullable=True)

    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(50), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)

    role = db.Column(db.String(10), nullable=False, default='client', index=True)  # 'client', 'provider', 'admin'
    email_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=False)

    last_login = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiry = db.Column(db.DateTime(timezone=True), nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class Provider(db.Model):
    __tablename__ = 'providers'

    provider_id = db.Column(
        db.Integer,
        db.ForeignKey('users.user_id', ondelete='CASCADE'),
        primary_key=True
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.user_id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

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

    created_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

  # Relación a Establishment (ya existente)
    establishments = db.relationship(
        'Establishment',
        backref=db.backref('provider', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    # Validaciones
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
            'user_id': self.user_id,
            'email': user_info.get('email'),
            'first_name': user_info.get('first_name'),
            'last_name': user_info.get('last_name'),
            'telefono_contacto': self.telefono_contacto,
            'email_contacto': self.email_contacto,
            'web': self.web,
            'nombre_comercial': self.nombre_comercial,
            'cif': self.cif,
            'tipo_empresa': self.tipo_empresa,
            'bio': self.bio,
            'imagen_perfil_url': self.imagen_perfil_url,
            'verificado': self.verificado,
            'activo': self.activo,
            'timezone': self.timezone,
            'idiomas_hablados': self.idiomas_hablados,
            'direccion_fiscal': self.direccion_fiscal,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    
class Establishment(db.Model):
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

    tags = db.Column(postgresql.ARRAY(db.String), nullable=True)
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

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    services = db.relationship(
        'Service',
        back_populates='establishment',        
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    tags = db.relationship(
    'Tag',
    secondary='establecimiento_tags',
    back_populates='establishments'
    )


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





class Service(db.Model):
    __tablename__ = 'services'
    __table_args__ = (
        UniqueConstraint('establishment_id', 'nombre', name='uix_establishment_nombre'),
    )

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    duracion_minutos = db.Column(db.Integer, nullable=False)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    categoria = db.Column(db.String(100), nullable=True, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    orden = db.Column(db.Integer, nullable=True)
    requiere_confirmacion_manual = db.Column(db.Boolean, nullable=True)
    limite_reservas_diarias = db.Column(db.Integer, nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relaciones
    establishment = db.relationship(
        'Establishment',
        back_populates='services'
    )
    appointments = db.relationship(
        'Appointment',
        back_populates='service',
        lazy='dynamic',
        cascade="save-update, merge"
    )

    # Validaciones
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AvailabilityRule(db.Model):
    __tablename__ = 'availability_rules'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    dia_semana = db.Column(day_of_week_enum, nullable=False, index=True)  # 0=Lunes, 6=Domingo

    hora_inicio = db.Column(db.Time(timezone=False), nullable=False)
    hora_fin = db.Column(db.Time(timezone=False), nullable=False)

    activo = db.Column(db.Boolean, default=True, nullable=False, index=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    establishment = db.relationship(
        'Establishment',
        backref=db.backref('availability_rules', lazy='dynamic')
    )

    @validates('hora_inicio', 'hora_fin')
    def validate_time_range(self, key, value):
        if key == 'hora_inicio':
            if hasattr(self, 'hora_fin') and self.hora_fin and value >= self.hora_fin:
                raise ValueError("La hora de inicio debe ser anterior a la hora de finalización.")
        elif key == 'hora_fin':
            if hasattr(self, 'hora_inicio') and self.hora_inicio and value <= self.hora_inicio:
                raise ValueError("La hora de finalización debe ser posterior a la hora de inicio.")
        return value

    def __repr__(self):
        return f'<AvailabilityRule: Est {self.establishment_id} Día {self.dia_semana} {self.hora_inicio}–{self.hora_fin}>'

    def to_dict(self):
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'dia_semana': self.dia_semana.value if hasattr(self.dia_semana, 'value') else self.dia_semana,
            'hora_inicio': self.hora_inicio.strftime('%H:%M:%S'),
            'hora_fin': self.hora_fin.strftime('%H:%M:%S'),
            'activo': self.activo,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }



class TimeBlock(db.Model):
    __tablename__ = 'time_blocks'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)

    is_available = db.Column(db.Boolean, nullable=False, default=False)
    reason = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    establishment = db.relationship(
        'Establishment',
        backref=db.backref('time_blocks', lazy='dynamic')
    )

    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value):
        if key == 'start_datetime':
            if hasattr(self, 'end_datetime') and self.end_datetime and value >= self.end_datetime:
                raise ValueError("La fecha/hora de inicio debe ser anterior a la de finalización.")
        elif key == 'end_datetime':
            if hasattr(self, 'start_datetime') and self.start_datetime and value <= self.start_datetime:
                raise ValueError("La fecha/hora de finalización debe ser posterior a la de inicio.")
        return value

    def __repr__(self):
        status = "disponible" if self.is_available else "no disponible"
        return f'<TimeBlock: Est {self.establishment_id} {self.start_datetime}–{self.end_datetime} ({status})>'

    def to_dict(self):
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'is_available': self.is_available,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=False, index=True)
    service_id = db.Column(
        db.Integer,
        db.ForeignKey('services.id', ondelete='SET NULL'),
        nullable=False,
        index=True
    )

    

    start_time = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)

    estado = db.Column(appointment_status_enum, nullable=False, default='CONFIRMED', index=True)
    notas_cliente = db.Column(db.Text, nullable=True)
    notas_internas = db.Column(db.Text, nullable=True)

    requiere_confirmacion = db.Column(db.Boolean, nullable=True)
    origen_reserva = db.Column(db.String(50), nullable=True)
    precio_final = db.Column(db.Numeric(10, 2), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    

    # Relaciones
    user = db.relationship('User', backref=db.backref('appointments', lazy='dynamic'))
    service = db.relationship(
        'Service',
        back_populates='appointments'
    )

    @validates('start_time', 'end_time')
    def validate_datetime_range(self, key, value):
        if key == 'start_time':
            if hasattr(self, 'end_time') and self.end_time is not None and value >= self.end_time:
                raise ValueError("La fecha/hora de inicio debe ser anterior a la de finalización.")
        elif key == 'end_time':
            if hasattr(self, 'start_time') and self.start_time is not None and value <= self.start_time:
                raise ValueError("La fecha/hora de finalización debe ser posterior a la de inicio.")
        return value

    @validates('precio_final')
    def validate_precio(self, key, precio):
        if precio is not None:
            try:
                precio_f = float(precio)
                if precio_f < 0:
                    raise ValueError("El precio final no puede ser negativo.")
            except (ValueError, TypeError):
                raise ValueError("El precio final debe ser un número válido.")
        return precio

    def __repr__(self):
        estado_val = self.estado.value if hasattr(self.estado, 'value') else self.estado
        return f'<Appointment ID {self.id}: Service ID {self.service_id} from {self.start_time} ({estado_val})>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'service_id': self.service_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'estado': self.estado.value if hasattr(self.estado, 'value') else self.estado,
            'notas_cliente': self.notas_cliente,
            'notas_internas': self.notas_internas,
            'requiere_confirmacion': self.requiere_confirmacion,
            'origen_reserva': self.origen_reserva,
            'precio_final': str(self.precio_final) if self.precio_final is not None else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Staff(db.Model):
    __tablename__ = 'staff'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    nombre = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(100), nullable=False)

    email_contacto = db.Column(db.String(100), nullable=True)
    telefono_contacto = db.Column(db.String(50), nullable=True)
    imagen_perfil = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=True)

    activo = db.Column(db.Boolean, nullable=False, default=True)
    visible_web = db.Column(db.Boolean, nullable=False, default=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    establishment = db.relationship(
        'Establishment',
        backref=db.backref('staff_members', lazy='dynamic')
    )

    # Validaciones
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Tag(db.Model):
    __tablename__ = 'tags'
    __table_args__ = (
        db.UniqueConstraint('nombre', 'tipo', name='uix_nombre_tipo'),
    )

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(100), nullable=False)  # Ej: "tipo_establecimiento", "reserva"
    color = db.Column(db.String(7), nullable=True)  # Ej: "#FF5733"
    icono = db.Column(db.String(100), nullable=True)
    activo = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    establishments = db.relationship(
        'Establishment',
        secondary='establecimiento_tags',
        back_populates='tags'
    )

    @validates('color')
    def validate_color(self, key, value):
        if value and not value.startswith('#') or len(value) != 7:
            raise ValueError("El color debe estar en formato hexadecimal, ej. #AABBCC.")
        return value

    def __repr__(self):
        return f'<Tag ID {self.id}: {self.nombre} ({self.tipo})>'

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'tipo': self.tipo,
            'color': self.color,
            'icono': self.icono,
            'activo': self.activo,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class EstablishmentTag(db.Model):
    __tablename__ = 'establecimiento_tags'

    id = db.Column(db.Integer, primary_key=True)
    establecimiento_id = db.Column(
        db.Integer,
        db.ForeignKey('establishments.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    tag_id = db.Column(
        db.Integer,
        db.ForeignKey('tags.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    tag = db.relationship('Tag', backref=db.backref('establecimiento_tags', cascade='all, delete-orphan'))
    establecimiento = db.relationship('Establishment', backref=db.backref('establecimiento_tags', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<EstablishmentTag: Est {self.establecimiento_id} ↔ Tag {self.tag_id}>'
