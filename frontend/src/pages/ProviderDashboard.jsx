// frontend/src/pages/ProviderDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProviderDashboardSummary } from '../services/dashboardService';

// Un pequeño componente para mostrar las tarjetas de estadísticas
const StatCard = ({ title, value, linkTo, linkText }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-medium text-gray-500">{title}</h3>
    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    {linkTo && (
      <div className="mt-4">
        <Link to={linkTo} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          {linkText} →
        </Link>
      </div>
    )}
  </div>
);

// Componente para mostrar una cita individual en la lista de "Hoy"
const TodayAppointmentItem = ({ appointment }) => (
  <li className="py-3 flex justify-between items-center">
    <div>
      <p className="text-md font-medium text-gray-800">{appointment.service.nombre}</p>
      <p className="text-sm text-gray-500">con {appointment.user.first_name} {appointment.user.last_name}</p>
    </div>
    <span className="font-semibold text-gray-700">{new Date(appointment.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
  </li>
);


const ProviderDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await getProviderDashboardSummary();
        setSummary(data);
      } catch (err) {
        setError("No se pudo cargar el resumen del dashboard.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) return <div className="page-wrapper"><p>Cargando dashboard...</p></div>;
  if (error) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Panel de Control</h1>
        <p>Aquí tienes un resumen rápido de tu actividad.</p>
      </header>
      
      {/* Sección de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Citas para Hoy" 
          value={summary?.today_appointments?.length || 0}
        />
        <StatCard 
          title="Próximas Citas (7 días)" 
          value={summary?.upcoming_week_count || 0}
        />
        {/* Podríamos añadir más tarjetas, como "Ingresos del Mes" en el futuro */}
      </div>
      
      {/* Sección de Citas de Hoy */}
      <div className="profile-card">
        <h2 className="text-xl font-bold mb-4">Agenda de Hoy</h2>
        {summary?.today_appointments?.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {summary.today_appointments.map(appt => (
              <TodayAppointmentItem key={appt.id} appointment={appt} />
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No tienes citas programadas para hoy.</p>
        )}
      </div>

      {/* Sección de Última Reserva (opcional) */}
      {summary?.latest_booking && (
        <div className="profile-card mt-8">
          <h2 className="text-xl font-bold mb-4">Última Reserva Recibida</h2>
          <p><strong>{summary.latest_booking.service.nombre}</strong> para <strong>{summary.latest_booking.user.first_name}</strong></p>
          <p className="text-sm text-gray-500">
            Reservado el {new Date(summary.latest_booking.created_at).toLocaleString('es-ES')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProviderDashboard;