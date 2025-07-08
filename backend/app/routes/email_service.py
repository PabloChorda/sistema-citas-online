from flask_mail import Message
from flask import current_app, url_for, Blueprint
from app import mail
from zoneinfo import ZoneInfo


bp = Blueprint('email', __name__, url_prefix='/email')

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
    reset_link = f"http://localhost:5173/reset-password/{token}"
    nombre = user.first_name or 'usuario'

    html_body = f"""
        <p>Hola <strong>{nombre}</strong>,</p>
        <p>Solicitaste un restablecimiento de contraseña.</p>
        <p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p>
        <p><a href="{reset_link}">Restablecer contraseña</a></p>
        <p>Si no fuiste tú, puedes ignorar este mensaje.</p>
    """

    return send_email(
        subject="Restablece tu contraseña",
        recipients=[user.email],
        html=html_body,
        body=f"Hola {nombre}, restablece tu contraseña aquí: {reset_link}"
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