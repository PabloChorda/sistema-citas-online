// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
// --- 1. IMPORTAMOS LA FUNCIÓN DE CANCELAR ---
import { getAppointmentsForEstablishment } from '../services/establishmentService';
import { cancelAppointment } from '../services/appointmentService';
import Card from '../components/ui/Card';

const toYYYYMMDD = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- 2. ACTUALIZAMOS EL COMPONENTE DE LA FILA ---
const AppointmentRow = ({ appointment, onCancel }) => {
  const isCancelable = appointment.estado === 'CONFIRMED' || appointment.estado === 'PENDING_PROVIDER';

  return (
    <tr className="border-b border-gray-200">
      <td className="py-3 px-4">{new Date(appointment.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
      <td className="py-3 px-4">{appointment.service?.nombre || 'N/A'}</td>
      <td className="py-3 px-4">{appointment.user?.first_name || 'Cliente'} {appointment.user?.last_name || ''}</td>
      <td className="py-3 px-4">{appointment.estado}</td>
      <td className="py-3 px-4 text-center">
        {/* Mostramos el botón de cancelar solo si la cita está en un estado válido */}
        {isCancelable ? (
          <button 
            onClick={() => onCancel(appointment.id)}
            className="text-red-600 hover:underline text-sm font-medium"
          >
            Cancelar
          </button>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
    </tr>
  );
};


const ProviderAppointments = () => {
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Usamos useCallback para que la función no se recree innecesariamente
  const fetchAppointments = useCallback(async () => {
    if (!establishmentId) return;
    try {
      setLoading(true);
      const dateStr = toYYYYMMDD(selectedDate);
      const data = await getAppointmentsForEstablishment(establishmentId, dateStr);
      setAppointments(data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
    } catch (err) {
      setError('No se pudieron cargar las citas.');
    } finally {
      setLoading(false);
    }
  }, [establishmentId, selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // --- 3. CREAMOS LA FUNCIÓN HANDLER PARA CANCELAR ---
  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm('¿Estás seguro de que quieres cancelar esta cita? Se notificará al cliente.')) {
      try {
        // Llamamos a la función del servicio que ya teníamos
        await cancelAppointment(appointmentId);
        // Refrescamos la lista para ver el estado actualizado
        await fetchAppointments();
      } catch (err) {
        alert(`Error al cancelar la cita: ${err.message}`);
        console.error(err);
      }
    }
  };

  const handleDateChange = (e) => {
    const dateValue = e.target.value;
    const dateObject = new Date(dateValue + 'T00:00:00');
    setSelectedDate(dateObject);
  };

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Agenda de Citas</h1>
        {establishmentName && <p>Mostrando citas para: <strong>{establishmentName}</strong></p>}
      </header>
      <div className="mb-6">
        <label htmlFor="agenda-date" className="block text-sm font-medium text-gray-700 mb-1">Seleccionar fecha</label>
        <input type="date" id="agenda-date" value={toYYYYMMDD(selectedDate)} onChange={handleDateChange} className="p-2 border border-gray-300 rounded-md shadow-sm" />
      </div>
      <Card>
        {loading && <p className="p-4 text-center">Cargando agenda...</p>}
        {error && <div className="p-4 text-center"><p className="error-message">{error}</p></div>}
        {!loading && !error && (
          appointments.length > 0 ? (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-4 text-left">Hora</th>
                  <th className="py-2 px-4 text-left">Servicio</th>
                  <th className="py-2 px-4 text-left">Cliente</th>
                  <th className="py-2 px-4 text-left">Estado</th>
                  <th className="py-2 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  // --- 4. PASAMOS LA FUNCIÓN AL COMPONENTE HIJO ---
                  <AppointmentRow key={appt.id} appointment={appt} onCancel={handleCancelAppointment} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-center text-gray-500">No hay citas programadas para el día seleccionado.</p>
          )
        )}
      </Card>
    </div>
  );
};

export default ProviderAppointments;