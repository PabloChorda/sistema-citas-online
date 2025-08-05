# backend/app/models/__init__.py
"""
Punto de entrada para el paquete de modelos.

Este archivo importa todas las clases de modelos y tipos de datos para que
puedan ser accedidos fácilmente desde el resto de la aplicación, manteniendo
la compatibilidad con importaciones como `from app.models import User`.
"""
from .base import BaseModel
from .enums import day_of_week_enum, appointment_status_enum
from .user import User, Provider
from .establishment import Establishment, Staff
from .service import Service, staff_services
from .scheduling import AvailabilityRule, TimeBlock, Appointment,StaffAvailabilityRule
from .tag import Tag, EstablishmentTag

__all__ = [
    'BaseModel',
    'day_of_week_enum',
    'appointment_status_enum',
    'User',
    'Provider',
    'Establishment',
    'Staff',
    'staff_services',
    'Service',
    'AvailabilityRule',
    'TimeBlock',
    'Appointment',
    'Tag',
    'EstablishmentTag'
]