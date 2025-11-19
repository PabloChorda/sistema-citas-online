// frontend/src/pages/BookingSuccessPage.jsx

import React from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Función helper para formatear fechas
const formatDate = (dateString) => {
  if (!dateString) return '';
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

const BookingSuccessPage = () => {
  const location = useLocation();
  // Leemos la cita que nos ha pasado la página de confirmación
  const { appointment } = location.state || {};

  // Si un usuario llega a esta página directamente sin datos, lo redirigimos
  if (!appointment) {
    return <Navigate to="/" replace />;
  }

  return (
    // Usamos flexbox para centrar la tarjeta vertical y horizontalmente
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="text-center max-w-lg w-full">
        {/* Usamos un icono de Heroicons, más consistente */}
        <div className="success-icon-wrapper mx-auto text-green-500">
          <CheckCircleIcon />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-800">¡Reserva Confirmada!</h1>
        <p className="mt-2 text-gray-600">
          Hemos enviado un correo de confirmación con todos los detalles.
        </p>

        {/* Resumen de la Cita */}
        <div className="text-left bg-gray-50 p-4 rounded-lg my-6 border border-gray-200">
          <h2 className="font-semibold text-lg mb-3">Resumen de tu Cita</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Servicio:</strong> {appointment.service?.nombre}</p>
            <p><strong>Establecimiento:</strong> {appointment.service?.establishment?.nombre}</p>
            <p><strong>Fecha y Hora:</strong> {formatDate(appointment.start_time)}</p>
          </div>
        </div>

        {/* Botones de Acción para el siguiente paso */}
        <div className="mt-6 flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
          <Button to="/dashboard/client/appointments" variant="primary">
            Ver mis Citas
          </Button>
          <Button to="/" variant="outline">
            Reservar otra Cita
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BookingSuccessPage;
