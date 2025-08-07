// frontend/src/pages/ClientDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNextClientAppointment } from '../services/appointmentService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Un pequeño componente para mostrar la tarjeta de la próxima cita
const NextAppointmentCard = ({ appointment }) => {
  const { service, start_time } = appointment;
  
  const formattedDate = new Date(start_time).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const formattedTime = new Date(start_time).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <Card>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Tu Próxima Cita</h2>
      <div className="border-t border-gray-200 pt-4">
        <p className="text-lg font-semibold text-indigo-600">{service.nombre}</p>
        <p className="text-md text-gray-600">en {service.establishment.nombre}</p>
        <p className="mt-4 text-2xl font-bold text-gray-900">{formattedDate}</p>
        <p className="text-xl text-gray-700">a las {formattedTime}</p>
        <div className="mt-6">
          <Button to="/dashboard/client/appointments" variant="outline">
            Ver Todas Mis Citas
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Componente de bienvenida para cuando no hay citas
const WelcomeClient = () => (
  <Card>
    <h2 className="text-xl font-bold text-gray-800 mb-2">¡Bienvenido/a!</h2>
    <p className="text-gray-600">Parece que no tienes ninguna cita programada.</p>
    <div className="mt-6">
      <Button to="/" variant="primary">
        Reservar una Cita
      </Button>
    </div>
  </Card>
);

const ClientDashboard = () => {
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextAppointment = async () => {
      try {
        setLoading(true);
        const data = await getNextClientAppointment();
        setNextAppointment(data);
      } catch (error) {
        console.error("Error al cargar la próxima cita:", error);
        // No mostramos toast aquí para no ser intrusivos
      } finally {
        setLoading(false);
      }
    };
    fetchNextAppointment();
  }, []);

  if (loading) {
    return <p>Cargando tu información...</p>;
  }

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Tu Panel de Control</h1>
        <p>Aquí tienes un resumen de tu actividad.</p>
      </header>
      
      {nextAppointment ? (
        <NextAppointmentCard appointment={nextAppointment} />
      ) : (
        <WelcomeClient />
      )}
    </div>
  );
};

export default ClientDashboard;