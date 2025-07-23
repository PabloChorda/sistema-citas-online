# backend/app/commands/reminders.py

import click
from flask.cli import with_appcontext
from flask import current_app
from app.models import Appointment
from app.routes.email_service import send_appointment_reminder_email
from datetime import datetime, timedelta, timezone

@click.command('send-reminders')
@with_appcontext
def send_reminders_command():
    """
    Busca las citas programadas para el día siguiente y envía un email de recordatorio.
    Este comando está diseñado para ser ejecutado una vez al día a través de un Cron Job.
    """
    current_app.logger.info("--- [TAREA PROGRAMADA] Iniciando envío de recordatorios de citas ---")
    
    # Calcular el rango de fechas para "mañana" en UTC
    now_utc = datetime.now(timezone.utc)
    start_of_tomorrow = (now_utc + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_tomorrow = start_of_tomorrow + timedelta(days=1)

    # Buscar todas las citas confirmadas dentro de ese rango
    appointments_to_remind = Appointment.query.filter(
        Appointment.start_time >= start_of_tomorrow,
        Appointment.start_time < end_of_tomorrow,
        Appointment.estado == 'CONFIRMED'
    ).all()

    if not appointments_to_remind:
        current_app.logger.info("No se encontraron citas para mañana. Tarea finalizada.")
        return

    current_app.logger.info(f"Se encontraron {len(appointments_to_remind)} citas. Iniciando envíos...")
    
    success_count = 0
    fail_count = 0
    for appt in appointments_to_remind:
        try:
            # Intentamos enviar el correo para cada cita
            if send_appointment_reminder_email(appt):
                success_count += 1
            else:
                fail_count += 1
                current_app.logger.warning(f"Fallo controlado al enviar recordatorio para la cita ID: {appt.id}")
        except Exception as e:
            fail_count += 1
            # Registramos el error pero continuamos con las demás citas
            current_app.logger.error(f"Excepción al procesar recordatorio para la cita ID: {appt.id}: {e}", exc_info=True)

    current_app.logger.info("--- [TAREA PROGRAMADA] Envío de recordatorios finalizado ---")
    current_app.logger.info(f"Resultados: {success_count} enviados, {fail_count} fallidos.")