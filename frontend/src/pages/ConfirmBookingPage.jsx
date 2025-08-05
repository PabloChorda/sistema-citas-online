// frontend/src/pages/ConfirmBookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card'; // Usamos Card para consistencia
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

  // Si no hay detalles, mostramos un loader mientras redirigimos
  if (!bookingDetails) {
    return <div className="page-wrapper"><p>Cargando...</p></div>;
  }
  
  // Extraemos los datos del contexto
  const { establishment, service, date, slot, staffId, availableStaff } = bookingDetails;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Construimos el objeto Date completo y lo convertimos a ISO
    const datePart = new Date(date).toISOString().split('T')[0];
    const startTimeISO = new Date(`${datePart}T${slot}:00`).toISOString();

    const appointmentPromise = createAppointment({
      service_id: service.id,
      start_time: startTimeISO,
      notes_client: notes,
      staff_id: staffId, // <-- La nueva propiedad
    });

    try {
      const newAppointment = await toast.promise(appointmentPromise, {
        loading: 'Confirmando tu cita...',
        success: '¡Tu cita ha sido confirmada!',
        error: (err) => err.message || 'No se pudo completar la reserva.'
      });
      
      clearBookingInfo();
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
  
  // Buscamos el nombre del profesional seleccionado, si lo hay
  const selectedStaffMember = staffId ? availableStaff?.find(s => s.id === staffId) : null;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Confirmar tu Cita</h1>
        <p>Revisa los detalles y confirma tu reserva.</p>
      </header>

      <Card className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <p><strong>Establecimiento:</strong> {establishment.nombre}</p>
          <p><strong>Servicio:</strong> {service.nombre}</p>
          {/* Mostramos el profesional si fue seleccionado */}
          {selectedStaffMember && (
            <p><strong>Con:</strong> {selectedStaffMember.first_name} {selectedStaffMember.last_name}</p>
          )}
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
      </Card>
    </div>
  );
};

export default ConfirmBookingPage;