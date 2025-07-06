# backend/app/models/scheduling.py

from .. import db
from .base import BaseModel
from .enums import day_of_week_enum, appointment_status_enum
from sqlalchemy.orm import validates
from sqlalchemy import Time, DateTime, Numeric, Text, event
from datetime import time

class AvailabilityRule(BaseModel):
    __tablename__ = 'availability_rules'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    dia_semana = db.Column(day_of_week_enum, nullable=False, index=True)
    hora_inicio = db.Column(Time(timezone=False), nullable=False)
    hora_fin = db.Column(Time(timezone=False), nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False, index=True)

    establishment = db.relationship('Establishment', back_populates='availability_rules')

    # Validador simple para asegurar que el formato de hora es correcto al asignar
    @validates('hora_inicio', 'hora_fin')
    def validate_time_format(self, key, value):
        if isinstance(value, str):
            try:
                # Solo intentamos convertir para validar el formato.
                # SQLAlchemy se encargará de la conversión real.
                time.fromisoformat(value)
            except ValueError:
                raise ValueError(f"El formato para '{key}' es inválido. Debe ser HH:MM.")
        return value

    def __repr__(self):
        return f'<AvailabilityRule: Est {self.establishment_id} Día {self.dia_semana} {self.hora_inicio}–{self.hora_fin}>'

    def to_dict(self):
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'dia_semana': self.dia_semana,
            'hora_inicio': self.hora_inicio.strftime('%H:%M:%S'),
            'hora_fin': self.hora_fin.strftime('%H:%M:%S'),
            'activo': self.activo,
            **self.to_dict_base()
        }

# --- VALIDACIÓN A NIVEL DE OBJETO ---
# Esta función se registrará para ejecutarse ANTES de un INSERT o UPDATE en AvailabilityRule
@event.listens_for(AvailabilityRule, 'before_insert')
@event.listens_for(AvailabilityRule, 'before_update')
def receive_before_change(mapper, connection, target):
    """
    Se ejecuta justo antes de guardar en la BD.
    Aquí, el objeto 'target' (la instancia de AvailabilityRule) ya tiene
    todos sus valores nuevos asignados.
    """
    # SQLAlchemy ya ha convertido los strings a objetos 'time' en este punto.
    if target.hora_inicio and target.hora_fin and target.hora_inicio >= target.hora_fin:
        raise ValueError("La hora de inicio debe ser anterior a la hora de finalización.")

class TimeBlock(BaseModel):
    __tablename__ = 'time_blocks'

    id = db.Column(db.Integer, primary_key=True)
    establishment_id = db.Column(db.Integer, db.ForeignKey('establishments.id', ondelete='CASCADE'), nullable=False, index=True)
    start_datetime = db.Column(DateTime(timezone=True), nullable=False)
    end_datetime = db.Column(DateTime(timezone=True), nullable=False)
    is_available = db.Column(db.Boolean, nullable=False, default=False)
    reason = db.Column(db.String(255), nullable=True)

    # Relación
    establishment = db.relationship('Establishment', back_populates='time_blocks')

    @validates('start_datetime', 'end_datetime')
    def validate_datetime_range(self, key, value):
        if key == 'start_datetime' and hasattr(self, 'end_datetime') and self.end_datetime and value >= self.end_datetime:
            raise ValueError("La fecha/hora de inicio debe ser anterior a la de finalización.")
        elif key == 'end_datetime' and hasattr(self, 'start_datetime') and self.start_datetime and value <= self.start_datetime:
            raise ValueError("La fecha/hora de finalización debe ser posterior a la de inicio.")
        return value

    def __repr__(self):
        status = "disponible" if self.is_available else "no disponible"
        return f'<TimeBlock: Est {self.establishment_id} {self.start_datetime}–{self.end_datetime} ({status})>'

    def to_dict(self):
        # El created_at viene de BaseModel, no es necesario re-declararlo aquí.
        # to_dict_base() lo añadirá.
        return {
            'id': self.id,
            'establishment_id': self.establishment_id,
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'is_available': self.is_available,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

class Appointment(BaseModel):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id', ondelete='SET NULL'), nullable=False, index=True)
    start_time = db.Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = db.Column(DateTime(timezone=True), nullable=False)
    estado = db.Column(appointment_status_enum, nullable=False, default='CONFIRMED', index=True)
    notas_cliente = db.Column(Text, nullable=True)
    notas_internas = db.Column(Text, nullable=True)
    requiere_confirmacion = db.Column(db.Boolean, nullable=True)
    origen_reserva = db.Column(db.String(50), nullable=True)
    precio_final = db.Column(Numeric(10, 2), nullable=True)

    # Relaciones
    user = db.relationship('User', back_populates='appointments')
    service = db.relationship('Service', back_populates='appointments')

    @validates('start_time', 'end_time')
    def validate_datetime_range(self, key, value):
        if key == 'start_time' and hasattr(self, 'end_time') and self.end_time and value >= self.end_time:
            raise ValueError("La fecha/hora de inicio debe ser anterior a la de finalización.")
        elif key == 'end_time' and hasattr(self, 'start_time') and self.start_time and value <= self.start_time:
            raise ValueError("La fecha/hora de finalización debe ser posterior a la de inicio.")
        return value

    @validates('precio_final')
    def validate_precio(self, key, precio):
        if precio is not None:
            try:
                if float(precio) < 0: raise ValueError("El precio final no puede ser negativo.")
            except (ValueError, TypeError): raise ValueError("El precio final debe ser un número válido.")
        return precio

    def __repr__(self):
        return f'<Appointment ID {self.id}: Service ID {self.service_id} from {self.start_time} ({self.estado})>'

    def to_dict(self):
        """Serializa el objeto Appointment a un diccionario."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'estado': self.estado,
            'notas_cliente': self.notas_cliente,
            'notas_internas': self.notas_internas,
            'requiere_confirmacion': self.requiere_confirmacion,
            'origen_reserva': self.origen_reserva,
            'precio_final': str(self.precio_final) if self.precio_final is not None else None,
            
            # Incluimos el objeto de servicio completo, que ya contiene el establecimiento.
            'service': self.service.to_dict() if self.service else None,
            
            **self.to_dict_base()
        }