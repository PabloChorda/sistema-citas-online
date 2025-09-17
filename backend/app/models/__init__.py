# backend/app/models/__init__.py
"""
Punto de entrada para el paquete de modelos.
"""
from .base import BaseModel
from .enums import day_of_week_enum, appointment_status_enum
from .user import User, Provider
from .establishment import Establishment, Staff
from .service import Service, staff_services
from .scheduling import AvailabilityRule, TimeBlock, Appointment, StaffAvailabilityRule
from .tag import Tag, EstablishmentTag
from .magic_link import MagicLink
from .phone_otp import PhoneOTP
from .whatsapp_invite import WhatsAppInvite
from .webhook_event import WebhookEvent
from .calendar_blackout import CalendarBlackout

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
    'EstablishmentTag',
    'MagicLink',
    'PhoneOTP',
    'StaffAvailabilityRule',
    'WhatsAppInvite',
    'WebhookEvent',
    'CalendarBlackout',
]
