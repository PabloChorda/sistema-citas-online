from datetime import datetime, timedelta, time
from sqlalchemy import delete
from app import db
from app.models import (
    User, Provider, Establishment, Service, Staff,
    AvailabilityRule, TimeBlock, Appointment
)

# ---------- Parámetros de la demo ----------
DEMO_PROVIDER_EMAIL = "demo@provider.com"
DEMO_PROVIDER_PASSWORD = "demo1234"
DEMO_CLIENT_EMAIL = "demo@client.com"
DEMO_CLIENT_PASSWORD = "demo1234"

BUSINESS_NAME = "Aviño Demo"
ESTABLISHMENT_NAME = "Aviño Demo Center"
ESTABLISHMENT_EMAIL = "demo@est.com"
ESTABLISHMENT_PHONE = "600000000"
ESTABLISHMENT_DESC = "Barbería de pruebas"

SERVICES = [
    {"name": "Corte de pelo", "duration_minutes": 30, "price": 15.00, "is_active": True, "descripcion": "Corte caballero"},
    {"name": "Color",        "duration_minutes": 60, "price": 35.00, "is_active": True, "descripcion": "Coloración básica"},
]

STAFF = [
    {"first_name": "Pablo", "last_name": "Demo", "email": "pablo@demo.com"},
    {"first_name": "Ana",   "last_name": "Demo", "email": "ana@demo.com"},
]

# Disponibilidad L-V 09:00–16:00 (weekday: 0=Lunes … 4=Viernes)
WEEKLY_RULES = {"start": time(9, 0), "end": time(16, 0), "days": list(range(0, 5))}

# Blackout parcial dentro de 2 días 12:30–13:30
BLACKOUT_OFFSET_DAYS = 2
BLACKOUT_NAME = "Descanso comida"
BLACKOUT_START = time(12, 30)
BLACKOUT_END = time(13, 30)

# Citas de ejemplo a partir de hoy+5
APPT_OFFSET_DAYS = 5


def _dt(day, hh, mm):
    return datetime.combine(day, time(hh, mm))


def seed_demo_data():
    """
    Resetea la base de datos para la DEMO de forma segura e idempotente,
    creando un conjunto coherente de datos para probar el flujo completo.
    """
    # ------------------------------------------------------------------
    # 1) Limpieza total acotada al provider demo (y al client demo)
    # ------------------------------------------------------------------
    demo_provider_user = User.query.filter_by(email=DEMO_PROVIDER_EMAIL).first()
    if demo_provider_user:
        provider = Provider.query.filter_by(user_id=demo_provider_user.id).first()
        if provider:
            # Elimina todo lo colgado al/los establecimientos de este provider
            ests = Establishment.query.filter_by(provider_id=provider.id).all()
            for est in ests:
                db.session.execute(delete(Appointment).where(Appointment.establishment_id == est.id))
                db.session.execute(delete(TimeBlock).where(TimeBlock.establishment_id == est.id))
                db.session.execute(delete(AvailabilityRule).where(AvailabilityRule.establishment_id == est.id))
                db.session.execute(delete(Service).where(Service.establishment_id == est.id))
                db.session.execute(delete(Staff).where(Staff.establishment_id == est.id))
                db.session.delete(est)
            db.session.delete(provider)
        db.session.delete(demo_provider_user)

    demo_client_user = User.query.filter_by(email=DEMO_CLIENT_EMAIL).first()
    if demo_client_user:
        db.session.execute(delete(Appointment).where(Appointment.client_id == demo_client_user.id))
        db.session.delete(demo_client_user)

    db.session.commit()

    # ------------------------------------------------------------------
    # 2) Crear usuarios demo (provider + client)
    # ------------------------------------------------------------------
    prov_user = User(email=DEMO_PROVIDER_EMAIL, role="provider")
    prov_user.set_password(DEMO_PROVIDER_PASSWORD)  # asume método set_password
    cli_user = User(email=DEMO_CLIENT_EMAIL, role="client")
    cli_user.set_password(DEMO_CLIENT_PASSWORD)
    db.session.add_all([prov_user, cli_user])
    db.session.flush()  # para obtener IDs

    # ------------------------------------------------------------------
    # 3) Provider + Establecimiento (público, multi-staff)
    # ------------------------------------------------------------------
    provider = Provider(user_id=prov_user.id, business_name=BUSINESS_NAME)
    db.session.add(provider)
    db.session.flush()

    est = Establishment(
        provider_id=provider.id,
        name=ESTABLISHMENT_NAME,
        full_address="C/ Demo 123, Valencia",
        has_multiple_staff=True,
        is_public=True,
        phone=ESTABLISHMENT_PHONE,
        email=ESTABLISHMENT_EMAIL,
        description=ESTABLISHMENT_DESC,
        activo=True  # si tu modelo no tiene este campo, elimínalo
    )
    db.session.add(est)
    db.session.flush()

    # ------------------------------------------------------------------
    # 4) Servicios
    # ------------------------------------------------------------------
    service_objs = []
    for s in SERVICES:
        # Compatibilidad con posibles nombres en español
        obj = Service(
            establishment_id=est.id,
            name=s.get("name") or s.get("nombre"),
            duration_minutes=s.get("duration_minutes") or s.get("duracion_minutos"),
            price=s.get("price") or s.get("precio"),
            is_active=s.get("is_active") if "is_active" in s else s.get("activo", True),
            description=s.get("descripcion", "")
        )
        service_objs.append(obj)

    db.session.add_all(service_objs)
    db.session.flush()
    corte = service_objs[0]
    color = service_objs[1] if len(service_objs) > 1 else service_objs[0]

    # ------------------------------------------------------------------
    # 5) Staff
    # ------------------------------------------------------------------
    staff_objs = []
    for st in STAFF:
        st_obj = Staff(
            establishment_id=est.id,
            first_name=st["first_name"],
            last_name=st["last_name"],
            email=st["email"],
            active=True  # si tu modelo usa 'activo', cámbialo
        )
        staff_objs.append(st_obj)
    db.session.add_all(staff_objs)
    db.session.flush()
    pablo, ana = staff_objs[0], staff_objs[1]

    # ------------------------------------------------------------------
    # 6) Reglas de disponibilidad (L-V 09:00–16:00) por cada staff
    # ------------------------------------------------------------------
    for st in staff_objs:
        for dow in WEEKLY_RULES["days"]:
            rule = AvailabilityRule(
                establishment_id=est.id,
                staff_id=st.id,
                weekday=dow,            # si tu modelo usa 'dia_semana', cámbialo
                start_time=WEEKLY_RULES["start"],
                end_time=WEEKLY_RULES["end"]
            )
            db.session.add(rule)

    # ------------------------------------------------------------------
    # 7) Blackout parcial (ej. descanso comida)
    # ------------------------------------------------------------------
    blk_day = datetime.utcnow().date() + timedelta(days=BLACKOUT_OFFSET_DAYS)
    tb = TimeBlock(
        establishment_id=est.id,
        name=BLACKOUT_NAME,
        date=blk_day,
        start_time=BLACKOUT_START,
        end_time=BLACKOUT_END,
        is_full_day=False  # si tu modelo usa 'es_dia_completo', cámbialo
    )
    db.session.add(tb)
    db.session.flush()

    # ------------------------------------------------------------------
    # 8) Citas de ejemplo (esta semana y la próxima)
    # ------------------------------------------------------------------
    base_day = datetime.utcnow().date() + timedelta(days=APPT_OFFSET_DAYS)

    ap1 = Appointment(
        establishment_id=est.id,
        client_id=cli_user.id,
        staff_id=pablo.id,
        service_id=corte.id,
        start_time=_dt(base_day, 9, 0),
        status="CONFIRMED"
    )
    ap2 = Appointment(
        establishment_id=est.id,
        client_id=cli_user.id,
        staff_id=ana.id,
        service_id=color.id,
        start_time=_dt(base_day + timedelta(days=2), 11, 0),
        status="PENDING_PROVIDER"
    )
    # (Opcional) crea una tercera cita en la semana siguiente
    ap3 = Appointment(
        establishment_id=est.id,
        client_id=cli_user.id,
        staff_id=pablo.id,
        service_id=color.id,
        start_time=_dt(base_day + timedelta(days=7), 10, 30),
        status="CONFIRMED"
    )

    db.session.add_all([ap1, ap2, ap3])
    db.session.commit()
