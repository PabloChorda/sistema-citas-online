// frontend/src/pages/ConfirmBookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

// --- 1. IMPORTAMOS NUESTRO HOOK Y EL SERVICIO ---
import { useBooking } from '../context/BookingContext';
import { createAppointment } from '../services/appointmentService';

const ConfirmBookingPage = () => {
  const navigate = useNavigate();
  // --- 2. LEEMOS LOS DATOS Y FUNCIONES DEL CONTEXTO ---
  const { bookingDetails, clearBookingInfo } = useBooking();
  
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useEffect para redirigir si no hay datos en el contexto
  useEffect(() => {
    if (!bookingDetails) {
      console.error("No se encontraron detalles de reserva, redirigiendo a la página principal.");
      // Si el usuario llega aquí sin pasar por la BookingPage, lo mandamos a la home
      navigate('/');
    }
  }, [bookingDetails, navigate]);

  // Si no hay detalles de la reserva, mostramos un mensaje de carga
  // para evitar errores mientras el useEffect hace la redirección.
  if (!bookingDetails) {
    return (
      <div className="page-wrapper">
        <p>Cargando detalles de la reserva...</p>
      </div>
    );
  }
  
  // Extraemos los datos del contexto para usarlos más fácilmente
  const { establishment, service, date, slot } = bookingDetails;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    // --- 3. CONSTRUIMOS LA FECHA COMPLETA EN UTC ---
    // La 'date' guardada en el contexto ya es un string ISO
    // El 'slot' es 'HH:MM'. Los combinamos para crear un objeto Date válido
    // y luego lo convertimos a ISO string para la API.
    const datePart = new Date(date).toISOString().split('T')[0];
    const startTimeISO = new Date(`${datePart}T${slot}:00`).toISOString();

    try {
      await createAppointment({
        service_id: service.id,
        start_time: startTimeISO,
        notes_client: notes,
      });
      
      // --- 4. LIMPIAMOS EL CONTEXTO TRAS EL ÉXITO ---
      // Esto es importante para que no queden datos de reservas antiguas
      clearBookingInfo();

      navigate('/booking/success');

    } catch (err) {
      setError(err.message || 'No se pudo completar la reserva. El horario podría no estar ya disponible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // El formateo de la fecha ahora usa el string ISO guardado en el contexto
  const formattedDate = new Date(date).toLocaleDateString('es-ES', {
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
        <Button onClick={handleSubmit} disabled={isSubmitting} variant="primary">
          {isSubmitting ? 'Confirmando...' : 'Confirmar Cita'}
        </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmBookingPage;