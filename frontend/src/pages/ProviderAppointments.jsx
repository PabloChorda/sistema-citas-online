// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getAppointmentsForEstablishment } from '../services/establishmentService';

// Componente para una sola cita en la agenda
const AppointmentAgendaItem = ({ appointment }) => (
  <div className="p-4 border-b border-gray-200 last:border-b-0">
    <div className="flex justify-between items-center">
        <div>
            <p className="font-semibold text-gray-800">{appointment.service?.nombre || 'Servicio eliminado'}</p>
            <p className="text-sm text-gray-600">
                Cliente: {appointment.user?.first_name || 'Cliente'} {appointment.user?.last_name || ''}
            </p>
        </div>
        <div className="text-right">
            <p className="text-sm font-medium text-gray-800">
                {new Date(appointment.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(appointment.end_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-gray-500">
                {new Date(appointment.start_time).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
        </div>
    </div>
  </div>
);


const ProviderAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  useEffect(() => {
    if (!establishmentId) {
      setError('No se ha especificado un establecimiento. Por favor, vuelve a la lista de establecimientos y selecciona uno.');
      setLoading(false);
      return;
    }

    const fetchAppointments = async () => {
      try {
        setLoading(true);
        // --- 2. LLAMAMOS A LA API REAL ---
        // Reemplazamos los datos de ejemplo con la llamada al servicio
        const data = await getAppointmentsForEstablishment(establishmentId);
        
        // Ordenamos las citas por fecha (opcional, pero recomendado)
        const sortedData = data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        setAppointments(sortedData);

      } catch (err) {
        setError('No se pudieron cargar las citas para este establecimiento.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAppointments();
  }, [establishmentId]);

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Agenda de Citas</h1>
        {establishmentName ? (
            <p>Mostrando citas para el establecimiento: <strong>{establishmentName}</strong></p>
        ) : (
            <p>Selecciona un establecimiento para ver su agenda.</p>
        )}
      </header>
      
      <div className="profile-card">
        {loading && <p className="p-4 text-center">Cargando agenda...</p>}
        {error && (
            <div className="p-4 text-center">
                <p className="error-message">{error}</p>
                <Link to="/dashboard/provider/establishments" className="mt-4 inline-block text-indigo-600 hover:underline">
                    Volver a mis establecimientos
                </Link>
            </div>
        )}
        
        {!loading && !error && (
          <div>
            {appointments.length > 0 ? (
              appointments.map(appt => <AppointmentAgendaItem key={appt.id} appointment={appt} />)
            ) : (
              <p className="p-4 text-center text-gray-500">No hay citas programadas para este establecimiento.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderAppointments;