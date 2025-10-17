// frontend/src/components/client/AppointmentCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Busca token en varias claves (localStorage y sessionStorage)
function getAccessToken() {
  const keys = ['access_token', 'accessToken', 'refresh_token', 'refreshToken'];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

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

  const handleDownloadIcs = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        toast.error('No hay sesión activa.');
        return;
      }

      const resp = await fetch(`${API_BASE}/appointments/${appointment.id}/ics`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || 'No se pudo generar el archivo .ics');
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const svcName = service?.nombre || 'cita';
      a.href = url;
      a.download = `cita-${appointment.id}-${svcName}.ics`.replace(/\s+/g, '_');

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo descargar el .ics');
    }
  };

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
          <p className="text-md text-gray-700 font-semibold">{formatDate(start_time)}</p>
          <p className="text-sm text-gray-500">
            {service?.establishment?.direccion_completa || ''}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
        <button
          onClick={handleDownloadIcs}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline"
        >
          Añadir a Calendario (.ics)
        </button>

        {isActionable && (
          <div className="flex items-center space-x-6">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
