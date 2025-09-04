from flask_mail import Message
from flask import current_app, url_for, Blueprint
from app import mail
from zoneinfo import ZoneInfo
import os
from urllib.parse import urljoin


bp = Blueprint('email', __name__, url_prefix='/email')

def _frontend_url(path: str) -> str:
    """
    Construye una URL absoluta hacia el frontend usando FRONTEND_BASE_URL.
    FRONTEND_BASE_URL por defecto: http://localhost:5173
    """
    base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
    return f"{base.rstrip('/')}/{path.lstrip('/')}"


def send_email(subject, recipients, body=None, html=None):
    """Función genérica para enviar correos."""
    try:
        msg = Message(
            subject=subject,
            recipients=recipients,
            body=body,
            html=html
        )
        mail.send(msg)
        current_app.logger.info(f"Correo enviado a {recipients} con asunto '{subject}'")
        return True
    except Exception as e:
        current_app.logger.error(f"Error enviando correo a {recipients}: {e}", exc_info=True)
        return False


def send_login_notification(user):
    """Envia correo tras login exitoso."""
    nombre = user.first_name or 'usuario'
    return send_email(
        subject="Inicio de sesión exitoso",
        recipients=[user.email],
        body=f"Hola {nombre}, has iniciado sesión correctamente en el sistema de citas online.",
    )


def send_account_validation_email(user, token):
    """
    Envía un correo con enlace para validar la cuenta durante el registro.

    :param user: Objeto usuario (con .email, .first_name)
    :param token: Token generado para validar la cuenta
    """
    nombre = user.first_name or 'usuario'
    validation_link = url_for('api.auth.validate_account', token=token, _external=True)

    html_body = f"""
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>Gracias por registrarte en Citas Online.</p>
        <p>Por favor, haz clic en el siguiente enlace para validar tu cuenta:</p>
        <p><a href="{validation_link}">Validar cuenta</a></p>
        <p>Si no te registraste, puedes ignorar este correo.</p>
    """

    return send_email(
        subject="Valida tu cuenta en Citas Online",
        recipients=[user.email],
        html=html_body,
        body=f"Hola {nombre}, valida tu cuenta visitando este enlace: {validation_link}"
    )

def send_password_reset_email(user, token):
    """
    Envía el correo de restablecimiento de contraseña con un enlace al frontend.
    - FRONTEND_BASE_URL controla el host del enlace (por defecto http://localhost:5173)
    - PASSWORD_RESET_TTL_MINUTES controla el texto del TTL mostrado (por defecto 60)
    """
    # TTL mostrado en el correo (informativo)
    try:
        ttl_min = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "60"))
    except Exception:
        ttl_min = 60

    # Enlace al front
    reset_link = _frontend_url(f"reset-password/{token}")
    nombre = getattr(user, "first_name", None) or getattr(user, "email", None) or "usuario"

    # Texto plano (fallback)
    text_body = (
        f"Hola {nombre},\n\n"
        "Has solicitado restablecer tu contraseña de CitaFácil.\n"
        f"Abre este enlace para crear una nueva contraseña (válido durante {ttl_min} minutos):\n\n"
        f"{reset_link}\n\n"
        "Si no fuiste tú, puedes ignorar este mensaje."
    )

    # HTML
    html_body = f"""
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>Has solicitado restablecer tu contraseña de <strong>CitaFácil</strong>.</p>
        <p>
          <a href="{reset_link}" 
             style="display:inline-block;background:#4f46e5;color:#fff;
                    padding:10px 16px;border-radius:8px;text-decoration:none;">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">
          Este enlace es válido durante {ttl_min} minutos. 
          Si no solicitaste este cambio, puedes ignorar este correo.
        </p>
        <p style="color:#9ca3af;font-size:12px;">
          Si el botón no funciona, copia y pega esta URL en tu navegador:<br/>
          <span style="word-break:break-all;">{reset_link}</span>
        </p>
    """

    return send_email(
        subject="Restablece tu contraseña",
        recipients=[user.email],
        body=text_body,
        html=html_body
    )

def format_datetime_for_email(dt_utc, timezone_str):
    """Formatea una fecha/hora UTC a una zona horaria específica y legible."""
    try:
        provider_tz = ZoneInfo(timezone_str)
        dt_local = dt_utc.astimezone(provider_tz)
        # Formato amigable: "viernes, 5 de julio de 2024 a las 10:30"
        return dt_local.strftime('%A, %d de %B de %Y a las %H:%M')
    except:
        # Si falla, devuelve un formato simple en UTC
        return dt_utc.strftime('%Y-%m-%d %H:%M:%S UTC')

def send_appointment_confirmation_emails(appointment):
    """
    Envía correos de confirmación tanto al cliente como al proveedor.
    Esta función orquesta el envío de los dos correos.
    """
    if not appointment:
        return False

    client = appointment.user
    service = appointment.service
    establishment = service.establishment
    provider_user = establishment.provider.user # El usuario asociado al proveedor

    if not all([client, service, establishment, provider_user]):
        current_app.logger.error(f"Faltan datos para enviar email de confirmación de cita {appointment.id}")
        return False
        
    provider_timezone = establishment.provider.timezone or 'UTC'
    formatted_start_time = format_datetime_for_email(appointment.start_time, provider_timezone)

    # 1. Enviar correo al Cliente
    client_subject = f"✅ Cita Confirmada: {service.nombre} en {establishment.nombre}"
    client_html = f"""
        <p>Hola <strong>{client.first_name or 'tú'}</strong>,</p>
        <p>Tu cita ha sido confirmada con éxito. Aquí tienes los detalles:</p>
        <ul>
            <li><strong>Establecimiento:</strong> {establishment.nombre}</li>
            <li><strong>Dirección:</strong> {establishment.direccion_completa}</li>
            <li><strong>Servicio:</strong> {service.nombre}</li>
            <li><strong>Día y Hora:</strong> {formatted_start_time}</li>
            <li><strong>Precio:</strong> {appointment.precio_final} €</li>
        </ul>
        <p>¡Te esperamos!</p>
    """
    send_email(client_subject, [client.email], html=client_html)

    # 2. Enviar correo al Proveedor (a su email de contacto si existe, si no al de la cuenta)
    provider_email = establishment.provider.email_contacto or provider_user.email
    provider_subject = f"🔔 Nueva Cita Reservada: {service.nombre} a las {formatted_start_time}"
    provider_html = f"""
        <p>¡Hola <strong>{establishment.provider.nombre_comercial}</strong>!</p>
        <p>Has recibido una nueva reserva:</p>
        <ul>
            <li><strong>Cliente:</strong> {client.first_name or ''} {client.last_name or ''} ({client.email})</li>
            <li><strong>Servicio:</strong> {service.nombre}</li>
            <li><strong>Día y Hora:</strong> {formatted_start_time}</li>
        </ul>
        {f'<p><strong>Notas del cliente:</strong> {appointment.notas_cliente}</p>' if appointment.notas_cliente else ''}
        <p>La cita ha sido añadida a tu agenda.</p>
    """
    send_email(provider_subject, [provider_email], html=provider_html)
    
    return True

# --- NUEVA FUNCIÓN AÑADIDA ---

def send_appointment_reminder_email(appointment):
    """
    Envía un correo de recordatorio de cita al cliente.
    """
    if not appointment or not appointment.user or not appointment.service:
        current_app.logger.warning(f"Intento de enviar recordatorio para cita incompleta ID: {appointment.id if appointment else 'N/A'}")
        return False

    client = appointment.user
    service = appointment.service
    establishment = service.establishment
    
    provider_timezone = establishment.provider.timezone or 'UTC'
    formatted_start_time = format_datetime_for_email(appointment.start_time, provider_timezone)

    subject = f"⏰ Recordatorio de tu cita mañana: {service.nombre}"
    html_body = f"""
        <p>Hola <strong>{client.first_name or 'tú'}</strong>,</p>
        <p>Solo un recordatorio amistoso sobre tu cita de mañana.</p>
        <ul>
            <li><strong>Establecimiento:</strong> {establishment.nombre}</li>
            <li><strong>Dirección:</strong> {establishment.direccion_completa}</li>
            <li><strong>Servicio:</strong> {service.nombre}</li>
            <li><strong>Día y Hora:</strong> {formatted_start_time}</li>
        </ul>
        <p>Si necesitas reprogramar o cancelar, por favor, contacta con el establecimiento o gestiona tu cita desde tu panel de control.</p>
        <p>¡Te esperamos!</p>
    """
    
    return send_email(subject, [client.email], html=html_body)

def send_appointment_rescheduled_email(appointment, old_start_time):
    """
    Envía un correo de notificación al cliente cuando su cita ha sido reprogramada.
    """
    if not all([appointment, appointment.user, appointment.service, old_start_time]):
        current_app.logger.warning(f"Faltan datos para enviar email de reprogramación para cita ID: {appointment.id if appointment else 'N/A'}")
        return False

    client = appointment.user
    service = appointment.service
    establishment = service.establishment
    provider_timezone = establishment.provider.timezone or 'UTC'
    
    # Formateamos ambas fechas, la nueva y la antigua, para que sean legibles
    new_formatted_time = format_datetime_for_email(appointment.start_time, provider_timezone)
    old_formatted_time = format_datetime_for_email(old_start_time, provider_timezone)

    subject = f"🔄 Tu cita para {service.nombre} ha sido reprogramada"
    html_body = f"""
        <p>Hola <strong>{client.first_name or 'tú'}</strong>,</p>
        <p>Te informamos que tu cita en <strong>{establishment.nombre}</strong> ha sido modificada por el proveedor.</p>
        <p>Estos son los nuevos detalles:</p>
        <ul>
            <li><strong>Servicio:</strong> {service.nombre}</li>
            <li><strong>Nueva Fecha y Hora:</strong> {new_formatted_time}</li>
            <li><strong>Fecha y Hora Original:</strong> <strike>{old_formatted_time}</strike></li>
        </ul>
        <p>Si esta nueva fecha no te va bien, por favor, contacta con el establecimiento para encontrar una alternativa o gestiona tu cita desde tu panel de control.</p>
    """
    
    return send_email(subject, [client.email], html=html_body)

def send_appointment_cancellation_email(appointment, cancelled_by_role):
    """
    Envía un correo de notificación cuando una cita ha sido cancelada.
    """
    if not all([appointment, appointment.user, appointment.service]):
        current_app.logger.warning(f"Faltan datos para enviar email de cancelación para cita ID: {appointment.id if appointment else 'N/A'}")
        return False

    client = appointment.user
    service = appointment.service
    establishment = service.establishment
    provider_user = establishment.provider.user
    
    if not provider_user:
        current_app.logger.error(f"No se pudo encontrar el usuario proveedor para la cita {appointment.id}")
        return False
        
    provider_timezone = establishment.provider.timezone or 'UTC'
    formatted_start_time = format_datetime_for_email(appointment.start_time, provider_timezone)

    recipient = None
    subject = ''
    html_body = ''

    # El destinatario y el mensaje dependen de quién canceló la cita
    if cancelled_by_role == 'provider':
        # El proveedor canceló, por lo tanto, notificamos al cliente
        recipient = client.email
        subject = f"❌ Tu cita para {service.nombre} ha sido cancelada"
        html_body = f"""
            <p>Hola <strong>{client.first_name or 'tú'}</strong>,</p>
            <p>Te informamos que tu cita en <strong>{establishment.nombre}</strong> para el <strong>{formatted_start_time}</strong> ha sido cancelada por el proveedor.</p>
            <p>Si tienes alguna duda, por favor, contacta directamente con el establecimiento.</p>
            <p>Puedes buscar un nuevo horario o explorar otros servicios cuando quieras.</p>
        """
    elif cancelled_by_role == 'client':
        # El cliente canceló, por lo tanto, notificamos al proveedor
        recipient = establishment.provider.email_contacto or provider_user.email
        subject = f"⚠️ Notificación de Cancelación de Cita: {client.first_name} {client.last_name}"
        html_body = f"""
            <p>Hola <strong>{establishment.provider.nombre_comercial}</strong>,</p>
            <p>Te informamos que se ha cancelado una cita en tu agenda:</p>
            <ul>
                <li><strong>Cliente:</strong> {client.first_name or ''} {client.last_name or ''} ({client.email})</li>
                <li><strong>Servicio:</strong> {service.nombre}</li>
                <li><strong>Fecha y Hora Original:</strong> {formatted_start_time}</li>
            </ul>
            <p>Este hueco horario ha quedado libre en tu calendario.</p>
        """
    else:
        # Si el rol no es válido, no hacemos nada y salimos.
        return False
    
    return send_email(subject, [recipient], html=html_body)