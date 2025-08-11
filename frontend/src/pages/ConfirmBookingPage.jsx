// frontend/src/pages/ConfirmBookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useBooking } from '../context/BookingContext';
import { createAppointment, rescheduleAppointment } from '../services/appointmentService';

const ConfirmBookingPage = () => {
  const navigate = useNavigate();
  const { bookingDetails, clearBookingInfo } = useBooking();

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingDetails) {
      toast.error('No hay una reserva en curso para confirmar.');
      navigate('/');
    }
  }, [bookingDetails, navigate]);

  if (!bookingDetails) {
    return (
      <div className="page-wrapper">
        <p>Cargando...</p>
      </div>
    );
  }

  const {
    establishment,
    service,
    date,
    slot,
    staffId,
    availableStaff, // eslint-disable-line no-unused-vars
    rescheduleAppointmentId,
    role,
  } = bookingDetails;

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const datePart = new Date(date).toISOString().split('T')[0];
    const startTimeISO = new Date(`${datePart}T${slot}:00`).toISOString();

    try {
      if (rescheduleAppointmentId) {
        // --- REPROGRAMAR ---
        await toast.promise(
          rescheduleAppointment(rescheduleAppointmentId, startTimeISO),
          {
            loading: 'Reprogramando cita...',
            success: '¡Cita reprogramada!',
            error: (e) => e.message || 'No se pudo reprogramar la cita.',
          }
        );

        clearBookingInfo();

        if (role === 'provider') {
          const estId = establishment?.id;
          const estName = establishment?.nombre || '';
          if (estId) {
            navigate(
              `/dashboard/provider/appointments?est_id=${estId}&name=${encodeURIComponent(
                estName
              )}`
            );
          } else {
            navigate('/dashboard/provider/appointments');
          }
          return;
        }

        navigate('/booking/success');
        return;
      }

      // --- CREAR CITA (cliente) ---
      const newAppointment = await toast.promise(
        createAppointment({
          service_id: service.id,
          start_time: startTimeISO,
          notes_client: notes,
          staff_id: staffId,
        }),
        {
          loading: 'Confirmando tu cita...',
          success: '¡Tu cita ha sido confirmada!',
          error: (err) => err.message || 'No se pudo completar la reserva.',
        }
      );

      clearBookingInfo();
      navigate('/booking/success', { state: { appointment: newAppointment } });
    } catch (err) {
      console.error('Error en confirmación/reprogramación:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const selectedStaffMember = staffId
    ? (bookingDetails.availableStaff || []).find((s) => s.id === staffId)
    : null;

  return (
    <div className="page-wrapper">
      <header className="page-header mt-6">
        <h1>Confirmar tu Cita</h1>
        <p>Revisa los detalles y confirma tu reserva.</p>
      </header>

      <Card className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <p>
            <strong>Establecimiento:</strong> {establishment.nombre}
          </p>
          <p>
            <strong>Servicio:</strong> {service.nombre}
          </p>
          {selectedStaffMember && (
            <p>
              <strong>Con:</strong> {selectedStaffMember.first_name}{' '}
              {selectedStaffMember.last_name}
            </p>
          )}
          <p>
            <strong>Fecha:</strong> {formattedDate}
          </p>
          <p>
            <strong>Hora:</strong> {slot}
          </p>
          <p>
            <strong>Precio:</strong> {service.precio}€
          </p>
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
            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500"
          ></textarea>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between mt-6 gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="primary"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Confirmando...' : rescheduleAppointmentId ? 'Reprogramar' : 'Confirmar Cita'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfirmBookingPage;
