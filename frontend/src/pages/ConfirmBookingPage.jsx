// frontend/src/pages/ConfirmBookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import { useBooking } from '../context/BookingContext';
import { createAppointment } from '../services/appointmentService';

const ConfirmBookingPage = () => {
  const navigate = useNavigate();
  const { bookingDetails, clearBookingInfo } = useBooking();
  
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingDetails) {
      console.error("No se encontraron detalles de reserva, redirigiendo...");
      toast.error("No hay una reserva en curso para confirmar.");
      navigate('/');
    }
  }, [bookingDetails, navigate]);

  if (!bookingDetails) {
    return (
      <div className="page-wrapper">
        <p>Cargando detalles de la reserva...</p>
      </div>
    );
  }
  
  const { establishment, service, date, slot } = bookingDetails;

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const datePart = new Date(date).toISOString().split('T')[0];
    const startTimeISO = new Date(`${datePart}T${slot}:00`).toISOString();

    const appointmentPromise = createAppointment({
      service_id: service.id,
      start_time: startTimeISO,
      notes_client: notes,
    });

    try {
      // --- 1. CAPTURAMOS LA RESPUESTA DE LA API ---
      const newAppointment = await createAppointment({
        service_id: service.id,
        start_time: startTimeISO,
        notes_client: notes,
      });
      
      toast.success('¡Tu cita ha sido confirmada!');
      clearBookingInfo();
  
      // --- 2. PASAMOS LA CITA CREADA A LA PÁGINA DE ÉXITO ---
      navigate('/booking/success', { state: { appointment: newAppointment } });

    } catch (err) {
      console.error("Error al crear la cita:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

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