// frontend/src/pages/ClientAppointments.jsx

import React, { useState, useEffect } from 'react';
import { getClientAppointments, cancelAppointment } from '../services/appointmentService';
import AppointmentCard from '../components/client/AppointmentCard';

const ClientAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getClientAppointments();
      // Ordenamos las citas por fecha, de más reciente a más antigua
      const sortedData = data.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      setAppointments(sortedData);
    } catch (err) {
      setError("No se pudieron cargar tus citas.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm('¿Estás seguro de que quieres cancelar esta cita?')) {
      try {
        await cancelAppointment(appointmentId);
        // Refrescamos la lista para mostrar el estado actualizado
        await fetchAppointments();
      } catch (err) {
        alert(`Error al cancelar la cita: ${err.message}`);
        console.error(err);
      }
    }
  };

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Mis Citas</h1>
        <p>Aquí puedes ver el historial de tus citas programadas.</p>
      </header>
      
      {loading && <p>Cargando tus citas...</p>}
      {error && <p className="error-message">{error}</p>}
      
      {!loading && !error && (
        <div className="space-y-6">
          {appointments.length > 0 ? (
            appointments.map(appt => (
              <AppointmentCard 
                key={appt.id} 
                appointment={appt}
                onCancel={handleCancelAppointment} 
              />
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-lg shadow-sm">
              <p className="text-gray-500">Aún no tienes ninguna cita registrada.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientAppointments;