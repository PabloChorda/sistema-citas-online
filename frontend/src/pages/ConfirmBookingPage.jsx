// frontend/src/pages/ConfirmBookingPage.jsx

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAppointment } from '../services/appointmentService';

const ConfirmBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Obtenemos los datos pasados desde BookingPage
  const { establishment, service, date, slot } = location.state || {};
  
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si el usuario llega a esta página directamente sin datos, lo redirigimos.
  if (!establishment || !service || !date || !slot) {
    // Idealmente, redirigir a la página de inicio o a la de booking
    return <div className="page-wrapper"><p>Faltan datos para la reserva. Por favor, vuelve a empezar.</p></div>;
  }

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    // Construimos la fecha y hora completa en formato ISO UTC
    const startTimeISO = new Date(`${date}T${slot}:00`).toISOString();

    try {
      await createAppointment({
        service_id: service.id,
        start_time: startTimeISO,
        notes_client: notes,
      });
      
      // Si todo va bien, redirigimos a una página de éxito
      navigate('/booking/success');

    } catch (err) {
      setError(err.message || 'No se pudo completar la reserva. El horario podría no estar ya disponible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(`${date}T${slot}`).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Confirmar tu Cita</h1>
        <p>Revisa los detalles y confirma tu reserva.</p>
      </header>

      <div className="profile-card max-w-2xl mx-auto">
        <div className="space-y-4">
          <p><strong>Establecimiento:</strong> {establishment.nombre}</p>
          <p><strong>Servicio:</strong> {service.nombre}</p>
          <p><strong>Fecha:</strong> {formattedDate}</p>
          <p><strong>Hora:</strong> {slot}</p>
          <p><strong>Precio:</strong> {service.precio}€</p>
        </div>

        <hr className="my-6" />

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notas para el proveedor (opcional)
          </label>
          <textarea
            id="notes"
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          ></textarea>
        </div>

        {error && <p className="error-message mt-4">{error}</p>}
        
        <div className="flex justify-end mt-6">
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar Cita'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmBookingPage;