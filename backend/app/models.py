# backend/app/models.py
from . import db # Importa la instancia db desde app/__init__.py
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.sql import func # Para server_default=func.now()
from sqlalchemy.orm import validates # Para validaciones
from sqlalchemy.dialects.postgresql import ENUM as PgEnum # Para enums en PostgreSQL

# --- Enums (Opcional, pero bueno para consistencia) ---
# Si los usas, recuerda gestionar su creación/eliminación en las migraciones
# class UserRoleEnum(PgEnum): # Ejemplo si usaras un Enum para roles
#     CLIENT = "client"
#     PROVIDER = "provider"

# --- Modelos ---

class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='client', index=True) # 'client', 'provider'
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relación uno-a-uno (o uno-a-cero) con Provider.
    # Un User (si es 'provider') tiene un ProviderProfile.
    # El 'provider_profile' en User permite acceder al Provider.
    # El backref 'user' en Provider permite acceder desde Provider a su objeto User.
    provider_profile = db.relationship(
        'Provider',
        backref=db.backref('user', uselist=False, lazy='joined'), # Acceso desde Provider: provider_instance.user
        uselist=False, # Es una relación uno-a-(cero o uno)
        cascade="all, delete-orphan" # Si se borra el User, se borra su ProviderProfile
    )

    # Relación uno-a-muchos: Un cliente (User) puede tener muchas citas.
    client_appointments = db.relationship(
        'Appointment',
        foreign_keys='Appointment.client_id', # Especifica la FK para esta relación
        backref=db.backref('client_user', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User ID {self.user_id}: {self.email} ({self.role})>'

    def to_dict(self, include_profile=False):
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

    # provider_id es PK y FK a users.user_id.
    provider_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)

    business_name = db.Column(db.String(255), nullable=False)
    business_type = db.Column(db.String(100), nullable=True)
    address = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True)
    timezone = db.Column(db.String(50), nullable=False, default='UTC')
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # El atributo 'user' para acceder al User asociado es creado por el backref en User.provider_profile.

    # Relación uno-a-muchos: Un Provider ofrece muchos Services.
    services_offered = db.relationship(
        'Service',
        backref=db.backref('provider', lazy='joined'), # Acceso desde Service: service_instance.provider
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    # Relación uno-a-muchos: Un Provider tiene muchas reglas de disponibilidad.
    availability_rules = db.relationship(
        'AvailabilityRule',
        backref=db.backref('provider_rule_owner', lazy='joined'), # Nombre único para backref
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    # Relación uno-a-muchos: Un Provider tiene muchos bloqueos de tiempo.
    time_blocks = db.relationship(
        'TimeBlock',
        backref=db.backref('provider_block_owner', lazy='joined'), # Nombre único para backref
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    # Relación uno-a-muchos: Un proveedor (Provider) tiene muchas citas.
    provider_appointments = db.relationship(
        'Appointment',
        foreign_keys='Appointment.provider_id', # Especifica la FK para esta relación
        backref=db.backref('provider_user_profile', lazy='joined'), # Nombre único para backref
        lazy='dynamic',
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f'<Provider ID {self.provider_id}: {self.business_name}>'

    def to_dict(self):
        # El user_id es el mismo que provider_id
        user_info = self.user.to_dict() if self.user else {} # Obtener info del User asociado
        return {
            'provider_id': self.provider_id,
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
    # provider_id ahora se refiere a Provider.provider_id, que es el mismo que User.user_id
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=True) # 10 dígitos en total, 2 después del punto decimal
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # El atributo 'provider' para acceder al Provider es creado por el backref en Provider.services_offered.

    # Relación uno-a-muchos: Un Service puede estar en muchas Appointments.
    appointments_for_service = db.relationship(
        'Appointment',
        backref=db.backref('service_booked', lazy='joined'),
        lazy='dynamic',
        cascade="all, delete-orphan" # Considera si quieres borrar citas si se borra el servicio
    )

    @validates('duration_minutes')
    def validate_duration(self, key, duration):
        if not isinstance(duration, int) or duration <= 0:
            raise ValueError("La duración del servicio debe ser un entero positivo.")
        return duration

    def __repr__(self):
        return f'<Service ID {self.id}: {self.name} (Provider ID: {self.provider_id})>'

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'name': self.name,
            'description': self.description,
            'duration_minutes': self.duration_minutes,
            'price': str(self.price) if self.price is not None else None, # Convertir Decimal a string para JSON
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# --- Modelos para Availability y Appointment (como los discutimos) ---

class DayOfWeekType(PgEnum): # Definición del tipo ENUM para PostgreSQL
    LUNES = "LUNES"
    MARTES = "MARTES"
    MIERCOLES = "MIERCOLES"
    JUEVES = "JUEVES"
    VIERNES = "VIERNES"
    SABADO = "SABADO"
    DOMINGO = "DOMINGO"
    # Necesitarás crear este tipo en la base de datos con Alembic:
    # En la migración:
    # day_of_week_enum = DayOfWeekType(name='dayofweektype', create_type=False)
    # day_of_week_enum.create(op.get_bind(), checkfirst=True) al migrar hacia arriba
    # day_of_week_enum.drop(op.get_bind(), checkfirst=True) al migrar hacia abajo

class AvailabilityRule(db.Model):
    __tablename__ = 'availability_rules'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Opción 1: Integer para día de la semana (0=Lunes, ..., 6=Domingo)
    day_of_week = db.Column(db.Integer, nullable=False)
    # Opción 2: Usar el tipo ENUM de PostgreSQL (preferible si tu DB lo soporta bien y lo gestionas en migraciones)
    # day_of_week_enum = db.Column(DayOfWeekType, nullable=False)

    start_time = db.Column(db.Time(timezone=False), nullable=False) # Solo la hora, sin zona horaria aquí
    end_time = db.Column(db.Time(timezone=False), nullable=False)   # La zona horaria la maneja el Provider

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # El backref 'provider_rule_owner' fue definido en Provider.availability_rules

    def __repr__(self):
        return f'<AvailabilityRule for Provider ID {self.provider_id} on day {self.day_of_week} from {self.start_time} to {self.end_time}>'

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'day_of_week': self.day_of_week, # O self.day_of_week_enum.value si usas el enum
            'start_time': self.start_time.strftime('%H:%M:%S'),
            'end_time': self.end_time.strftime('%H:%M:%S'),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class TimeBlock(db.Model):
    __tablename__ = 'time_blocks'

    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False) # Fecha y hora completas
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)
    reason = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    # El backref 'provider_block_owner' fue definido en Provider.time_blocks

    def __repr__(self):
        return f'<TimeBlock for Provider ID {self.provider_id} from {self.start_datetime} to {self.end_datetime}>'

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AppointmentStatusType(PgEnum): # Definición del tipo ENUM para PostgreSQL
    PENDING_PROVIDER = "PENDING_PROVIDER"
    CONFIRMED = "CONFIRMED"
    CANCELLED_BY_CLIENT = "CANCELLED_BY_CLIENT"
    CANCELLED_BY_PROVIDER = "CANCELLED_BY_PROVIDER"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"
    # Necesitarás crear este tipo en la base de datos con Alembic:
    # appointment_status_enum = AppointmentStatusType(name='appointmentstatustype', create_type=False)
    # appointment_status_enum.create(op.get_bind(), checkfirst=True)
    # appointment_status_enum.drop(op.get_bind(), checkfirst=True)

class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True, index=True) # Un cliente podría borrar su cuenta
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.provider_id', ondelete='CASCADE'), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='SET NULL'), nullable=True, index=True) # Un servicio podría ser borrado

    start_datetime = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end_datetime = db.Column(db.DateTime(timezone=True), nullable=False)

    status = db.Column(
        AppointmentStatusType, # Usa el tipo ENUM definido arriba
        nullable=False,
        default=AppointmentStatusType.CONFIRMED, # O PENDING_PROVIDER si necesitas confirmación
        index=True
    )
    notes_client = db.Column(db.Text, nullable=True)
    notes_provider = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Los backrefs 'client_user', 'provider_user_profile', 'service_booked' ya están definidos en los otros modelos.

    def __repr__(self):
        return f'<Appointment ID {self.id} for Service ID {self.service_id} at {self.start_datetime} ({self.status.value})>'

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'provider_id': self.provider_id,
            'service_id': self.service_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'status': self.status.value, # Obtener el valor string del Enum
            'notes_client': self.notes_client,
            'notes_provider': self.notes_provider,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # Podrías añadir información del cliente, proveedor o servicio si usas lazy='joined'
            # 'client_email': self.client_user.email if self.client_user else None,
            # 'service_name': self.service_booked.name if self.service_booked else None,
        }