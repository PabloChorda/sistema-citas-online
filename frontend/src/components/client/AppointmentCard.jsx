// frontend/src/components/client/AppointmentCard.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const formatDate = (dateString) => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

// Formatea Date/ISO -> YYYYMMDDTHHMMSSZ (UTC) para Google Calendar
const toGCalDateTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
};

// Construye el deep-link a Google Calendar
const buildGoogleCalendarUrl = (appointment) => {
  const { service, start_time, end_time, staff_member } = appointment;

  const titleParts = [];
  if (service?.nombre) titleParts.push(service.nombre);
  if (staff_member?.first_name || staff_member?.last_name || staff_member?.rol) {
    const staffShown =
      `${staff_member?.first_name ?? ''} ${staff_member?.last_name ?? ''}`.trim() ||
      staff_member?.rol ||
      '';
    if (staffShown) titleParts.push(`(con ${staffShown})`);
  }
  const text = titleParts.join(' ').trim() || 'Cita';

  const detailsLines = [];
  if (service?.establishment?.nombre) detailsLines.push(`Establecimiento: ${service.establishment.nombre}`);
  if (service?.descripcion) detailsLines.push(`Servicio: ${service.descripcion}`);
  const details = detailsLines.join('\n');

  const location =
    service?.establishment?.direccion_completa ||
    service?.establishment?.nombre ||
    '';

  const dates = `${toGCalDateTime(start_time)}/${toGCalDateTime(end_time || start_time)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates,
    details,
    location
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const AppointmentCard = ({ appointment, onCancel }) => {
  const { service, start_time, estado } = appointment;

  const statusStyles = {
    CONFIRMED: 'bg-green-100 text-green-800',
    PENDING_PROVIDER: 'bg-yellow-100 text-yellow-800',
    CANCELLED_BY_CLIENT: 'bg-red-100 text-red-800',
    CANCELLED_BY_PROVIDER: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    NO_SHOW: 'bg-gray-100 text-gray-800',
  };

  const now = new Date();
  const appointmentDate = new Date(start_time);
  const hoursUntilAppointment =
    (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isActionable =
    (estado === 'CONFIRMED' || estado === 'PENDING_PROVIDER') &&
    hoursUntilAppointment > 24;

  const gcalHref = buildGoogleCalendarUrl(appointment);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {service?.nombre || 'Servicio no disponible'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              en {service?.establishment?.nombre || 'Establecimiento no disponible'}
            </p>
          </div>
          <span
            className={`py-1 px-3 rounded-full text-xs font-semibold ${
              statusStyles[estado] || 'bg-gray-100'
            }`}
          >
            {estado.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-md text-gray-700 font-semibold">
            {formatDate(start_time)}
          </p>
          <p className="text-sm text-gray-500">
            {service?.establishment?.direccion_completa || ''}
          </p>
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-gray-50 px-6 py-3 flex flex-wrap gap-4 justify-end items-center">
        {/* Añadir a Google Calendar */}
        <a
          href={gcalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline"
        >
          Añadir a Google Calendar
        </a>

        {isActionable && (
          <>
            <button
              onClick={() => onCancel(appointment.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800 hover:underline"
            >
              Cancelar Cita
            </button>
            <Link
              to={`/booking/${service.establishment.id}?reschedule_appointment_id=${appointment.id}&service_id=${service.id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Reprogramar
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
