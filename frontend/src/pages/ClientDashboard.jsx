// frontend/src/pages/ClientDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNextClientAppointment } from '../services/appointmentService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Util: formatea fecha y hora en ES
function formatDateTimeISO(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const time = d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time };
}

// Tarjeta de próxima cita
const NextAppointmentCard = ({ appointment }) => {
  const serviceName = appointment?.service?.nombre || 'Servicio';
  const estName = appointment?.service?.establishment?.nombre || 'Establecimiento';
  const { date, time } = formatDateTimeISO(appointment?.start_time);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Tu próxima cita</h2>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {/* Info izquierda */}
        <div>
          <p className="text-base font-medium text-brand-700">{serviceName}</p>
          <p className="text-sm text-gray-600">en {estName}</p>
        </div>

        {/* Fecha/hora derecha */}
        <div className="sm:text-right">
          <p className="text-xl font-semibold text-gray-900 capitalize">{date}</p>
          <p className="text-base text-gray-700">a las {time}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-center sm:justify-start">
        <Button to="/dashboard/client/appointments" variant="secondarySoft">
          Ver todas mis citas
        </Button>
      </div>
    </Card>
  );
};

// Skeleton de carga
const NextAppointmentSkeleton = () => (
  <Card className="p-6">
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-40 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-36 bg-gray-200 rounded" />
        </div>
        <div className="space-y-2 sm:text-right">
          <div className="h-5 w-44 bg-gray-200 rounded ml-auto" />
          <div className="h-4 w-28 bg-gray-200 rounded ml-auto" />
        </div>
      </div>
      <div className="h-9 w-44 bg-gray-200 rounded" />
    </div>
  </Card>
);

// Estado vacío
const WelcomeClient = () => (
  <Card className="p-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-2">¡Bienvenido/a!</h2>
    <p className="text-gray-600">
      Parece que no tienes ninguna cita programada.
    </p>
    <div className="mt-6 flex justify-center sm:justify-start">
      <Button to="/" variant="secondary">Reservar una cita</Button>
    </div>
  </Card>
);

const ClientDashboard = () => {
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const fetchNextAppointment = async () => {
      try {
        setLoading(true);
        const data = await getNextClientAppointment();
        if (!ignore) setNextAppointment(data || null);
      } catch (error) {
        console.error('Error al cargar la próxima cita:', error);
        if (!ignore) setNextAppointment(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchNextAppointment();
    return () => { ignore = true; };
  }, []);

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">Tu panel de control</h1>
        <p className="text-gray-600 mt-1">Aquí tienes un resumen de tu actividad.</p>
      </header>

      {loading ? (
        <NextAppointmentSkeleton />
      ) : nextAppointment ? (
        <NextAppointmentCard appointment={nextAppointment} />
      ) : (
        <WelcomeClient />
      )}

      {/* Accesos rápidos opcionales (puedes descomentarlos si quieres más atajos) */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/" className="block">
          <Card className="p-4 hover:shadow-md transition">
            <p className="text-sm text-gray-500">Reservas</p>
            <p className="text-base font-medium text-gray-900">Nueva reserva</p>
          </Card>
        </Link>
        <Link to="/dashboard/client/appointments" className="block">
          <Card className="p-4 hover:shadow-md transition">
            <p className="text-sm text-gray-500">Citas</p>
            <p className="text-base font-medium text-gray-900">Ver historial</p>
          </Card>
        </Link>
        <Link to="/dashboard/client/profile" className="block">
          <Card className="p-4 hover:shadow-md transition">
            <p className="text-sm text-gray-500">Perfil</p>
            <p className="text-base font-medium text-gray-900">Editar datos</p>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default ClientDashboard;
