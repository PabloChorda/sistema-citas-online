from flask_mail import Message
from flask import current_app, url_for, Blueprint
from app import mail


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

