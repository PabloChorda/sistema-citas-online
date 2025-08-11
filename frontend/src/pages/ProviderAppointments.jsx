// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAppointmentsForEstablishment } from '../services/establishmentService';
import { cancelAppointment } from '../services/appointmentService';
import Card from '../components/ui/Card';
import AppointmentDetailModal from '../components/provider/AppointmentDetailModal';

const ProviderAppointments = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const calendarEl = useRef(null);
  const calendarInstanceRef = useRef(null);

  // Handlers modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleCancel = async (appointmentId) => {
    if (window.confirm('¿Estás seguro de que quieres cancelar esta cita?')) {
      try {
        await cancelAppointment(appointmentId);
        toast.success('Cita cancelada correctamente.');
        handleCloseModal(); // << cerrar modal tras éxito
        if (calendarInstanceRef.current) {
          calendarInstanceRef.current.refetchEvents();
        }
      } catch (error) {
        toast.error(`Error al cancelar: ${error.message}`);
        console.error(error);
      }
    }
  };

  const handleReschedule = (appointment) => {
    handleCloseModal();
    const service = appointment.service;
    if (service && service.establishment) {
      navigate(
        `/booking/${service.establishment.id}?reschedule_appointment_id=${appointment.id}&service_id=${service.id}&role=provider`
      );
    } else {
      toast.error('Error: Faltan datos para reprogramar.');
    }
  };

  // Monta calendario
  useEffect(() => {
    if (!calendarEl.current || !establishmentId || !window.FullCalendar) return;

    const calendar = new window.FullCalendar.Calendar(calendarEl.current, {
      initialView: 'timeGridWeek',
      locale: 'es',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      height: 'auto',
      allDaySlot: false,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
      views: {
        timeGridWeek: { slotMinTime: '07:00:00', slotMaxTime: '23:00:00' },
        timeGridDay: { slotMinTime: '07:00:00', slotMaxTime: '23:00:00' },
      },

      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const startDate = fetchInfo.start.toISOString().split('T')[0];
          const endDate = fetchInfo.end.toISOString().split('T')[0];
          const appointments = await getAppointmentsForEstablishment(
            establishmentId,
            startDate,
            endDate
          );

          const events = appointments.map((appt) => {
            const staffName = appt.staff_member
              ? `${appt.staff_member.first_name || ''} ${appt.staff_member.last_name || ''}`.trim()
              : '';
            const titlePrefix = appt.service?.nombre || '';
            const clientName = appt.user?.first_name || '';

            let eventTitle = `${titlePrefix} - ${clientName}`;
            if (staffName) eventTitle += ` (con ${staffName})`;

            return {
              id: appt.id,
              title: eventTitle,
              start: appt.start_time,
              end: appt.end_time,
              backgroundColor: appt.estado === 'CONFIRMED' ? '#10B981' : '#EF4444',
              borderColor: appt.estado === 'CONFIRMED' ? '#059669' : '#DC2626',
              extendedProps: { fullAppointment: appt },
            };
          });

          successCallback(events);
        } catch (error) {
          console.error('Error cargando eventos para el calendario:', error);
          failureCallback(error);
        }
      },

      eventClick: (clickInfo) => {
        setSelectedEvent(clickInfo.event);
        setIsModalOpen(true);
      },
    });

    calendarInstanceRef.current = calendar;
    calendar.render();

    return () => {
      if (calendarInstanceRef.current) {
        calendarInstanceRef.current.destroy();
        calendarInstanceRef.current = null;
      }
    };
  }, [establishmentId]);

  return (
    <>
      <div className="page-wrapper">
        <header className="page-header">
          <h1>Agenda de Citas</h1>
          {establishmentName && (
            <p>
              Mostrando agenda para: <strong>{establishmentName}</strong>
            </p>
          )}
        </header>

        <Card>
          <div ref={calendarEl}></div>
        </Card>
      </div>

      <AppointmentDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        onCancel={handleCancel}
        onReschedule={handleReschedule}
      />
    </>
  );
};

export default ProviderAppointments;
