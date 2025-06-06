# backend/app/models.py
from . import db # Importa la instancia db desde app/__init__.py
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.sql import func # Para server_default=func.now()
from sqlalchemy.orm import validates # Para validaciones
from sqlalchemy.dialects.postgresql import ENUM as PgEnum # Para enums en PostgreSQL

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
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False) # SG: Considerar longitud 256 o más si usas Argon2
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='client', index=True) # 'client', 'provider'
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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
        lazy='dynamic', # SG: 'dynamic' es bueno si necesitas aplicar más filtros. Si no, 'select' o 'joined' pueden ser más directos.
        cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User ID {self.user_id}: {self.email} ({self.role})>'

    def to_dict(self, include_profile=False): # SG: Buen método
        data = {
            'user_id': self.user_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone_number': self.phone_number,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.role == 'provider' and include_profile and self.provider_profile:
            data['provider_profile'] = self.provider_profile.to_dict()
        return data


class Provider(db.Model):
    __tablename__ = 'providers'

    provider_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    business_name = db.Column(db.String(255), nullable=False)
    business_type = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True) # SG: Considerar validación de URL o almacenamiento de archivos
    timezone = db.Column(db.String(50), nullable=False, default='UTC') # SG: Bueno, asegúrate de usar nombres de timezone válidos (ej. de la lista IANA)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

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
        user_info = self.user.to_dict() if self.user else {}
        return {
            'provider_id': self.provider_id,
            'user_id': self.user.user_id if self.user else None, # SG: Podrías añadir el user_id explícitamente
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
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Service(db.Model):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    appointments_for_service = db.relationship(
        'Appointment',
        backref=db.backref('service_booked', lazy='joined'),
        lazy='dynamic',
        # SG: `cascade="all, delete-orphan"` en esta relación significa que si borras un servicio,
        # se borrarán todas las citas asociadas a ese servicio. Esto puede ser lo deseado
        # o podrías querer un comportamiento diferente (ej. marcar las citas como 'canceladas_por_sistema'
        # o simplemente desvincularlas si `service_id` en `Appointment` puede ser `nullable=True` y `ondelete='SET NULL'`).
        # Tu FK `Appointment.service_id` tiene `ondelete='SET NULL'`, lo cual es inconsistente
        # con `cascade="all, delete-orphan"` aquí. Debes elegir uno:
        # Opción 1 (Borrar citas si se borra servicio): `cascade="all, delete-orphan"` en Service y `ondelete='CASCADE'` en Appointment.service_id FK.
        # Opción 2 (Mantener citas, desvincular servicio): No cascade aquí, y `ondelete='SET NULL'` en Appointment.service_id FK (como ya tienes).
        # En este caso, la relación no debería tener `cascade="all, delete-orphan"`.
        # SG: Sugiero Opción 2 por ahora, es menos destructivo:
        cascade="save-update, merge" # SG: O simplemente quitar el cascade si SET NULL es suficiente.
    )

    @validates('duration_minutes')
    def validate_duration(self, key, duration):
        if not isinstance(duration, int) or duration <= 0:
            raise ValueError("La duración del servicio debe ser un entero positivo.")
        return duration
    
    @validates('price')
    def validate_price(self, key, price): # SG: Buena idea validar el precio también
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
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'name': self.name,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'price': str(self.price) if self.price is not None else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class AvailabilityRule(db.Model):
    __tablename__ = 'availability_rules'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # SG: Has comentado la opción de ENUM. Si decides usar ENUM (recomendado), descomenta la columna
    # day_of_week_enum y comenta o elimina la de day_of_week (Integer).
    # La migración deberá manejar la creación del tipo ENUM como se discutió.
    #day_of_week = db.Column(db.Integer, nullable=False) # 0=Lunes, ..., 6=Domingo
    day_of_week = db.Column(day_of_week_enum, nullable=False) # SG: Si usas el ENUM

    start_time = db.Column(db.Time(timezone=False), nullable=False)
    end_time = db.Column(db.Time(timezone=False), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # SG: Añadir una validación para que start_time < end_time
    @validates('start_time', 'end_time')
    def validate_time_range(self, key, value):
        if key == 'start_time':
            # Si end_time ya está establecido y estamos actualizando start_time
            if hasattr(self, 'end_time') and self.end_time is not None and value >= self.end_time:
                raise ValueError("La hora de inicio debe ser anterior a la hora de finalización.")
        elif key == 'end_time':
            # Si start_time ya está establecido y estamos actualizando end_time
            if hasattr(self, 'start_time') and self.start_time is not None and value <= self.start_time:
                raise ValueError("La hora de finalización debe ser posterior a la hora de inicio.")
        return value

    def __repr__(self):
        return f'<AvailabilityRule for Provider ID {self.provider_id} on day {self.day_of_week} from {self.start_time} to {self.end_time}>'

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'day_of_week': self.day_of_week, # SG: o self.day_of_week.value si es ENUM
            'start_time': self.start_time.strftime('%H:%M:%S'),
            'end_time': self.end_time.strftime('%H:%M:%S'),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class TimeBlock(db.Model):
    __tablename__ = 'time_blocks'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    # SG: Podrías añadir un campo 'is_available' (Boolean) para indicar si este bloque
    # representa tiempo disponible adicional o tiempo no disponible (una excepción).
    # Por ejemplo, is_available=False para vacaciones, is_available=True para horas extra un sábado.
    # Si no, el 'reason' podría implicarlo, o asumes que todos los TimeBlock son "no disponible".
    is_available = db.Column(db.Boolean, nullable=False, default=False) # SG: Ejemplo, default a "no disponible"
    reason = db.Column(db.String(255), nullable=True) # SG: Razón de la no disponibilidad o disponibilidad extra

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    # SG: Añadir validación para que start_datetime < end_datetime
    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value):
        if key == 'start_datetime':
            if hasattr(self, 'end_datetime') and self.end_datetime is not None and value >= self.end_datetime:
                raise ValueError("La fecha/hora de inicio debe ser anterior a la fecha/hora de finalización.")
        elif key == 'end_datetime':
            if hasattr(self, 'start_datetime') and self.start_datetime is not None and value <= self.start_datetime:
                raise ValueError("La fecha/hora de finalización debe ser posterior a la fecha/hora de inicio.")
        return value

    def __repr__(self):
        availability_status = "available" if self.is_available else "unavailable"
        return f'<TimeBlock for Provider ID {self.provider_id} from {self.start_datetime} to {self.end_datetime} ({availability_status})>'

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'is_available': self.is_available, # SG: Añadido
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True, index=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='SET NULL'), nullable=True, index=True)

    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)

    status = db.Column(
        appointment_status_enum, # SG: Usando el ENUM definido arriba
        nullable=False,
        default='CONFIRMED', # SG: Accediendo al valor 'CONFIRMED' del enum
                                                        # O directamente: default='CONFIRMED' si el ENUM ya está registrado
                                                        # o default=AppointmentStatusType.CONFIRMED si AppointmentStatusType es tu clase Python
                                                        # Para PgEnum, es mejor usar el string o el índice si sabes que no cambiará.
                                                        # default='CONFIRMED' es lo más seguro si el tipo ya está en la DB.
        index=True
    )
    notes_client = db.Column(db.Text, nullable=True)
    notes_provider = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # SG: Añadir validación para que start_datetime < end_datetime
    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value): # SG: Reutilicé el nombre, está bien
        if key == 'start_datetime':
            if hasattr(self, 'end_datetime') and self.end_datetime is not None and value >= self.end_datetime:
                raise ValueError("La fecha/hora de inicio de la cita debe ser anterior a la fecha/hora de finalización.")
        elif key == 'end_datetime':
            if hasattr(self, 'start_datetime') and self.start_datetime is not None and value <= self.start_datetime:
                raise ValueError("La fecha/hora de finalización de la cita debe ser posterior a la fecha/hora de inicio.")
        return value

    def __repr__(self):
        # SG: .value puede no ser necesario si el objeto enum ya se castea a string bien.
        # SG: Pero ser explícito con .value es más seguro para el __repr__.
        status_val = self.status.value if hasattr(self.status, 'value') else self.status
        return f'<Appointment ID {self.id} for Service ID {self.service_id} at {self.start_datetime} ({status_val})>'

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'provider_id': self.provider_id,
            'service_id': self.service_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'status': self.status.value if hasattr(self.status, 'value') else self.status, # SG: Usar .value para el string
            'notes_client': self.notes_client,
            'notes_provider': self.notes_provider,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }