// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, createRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAppointmentsForEstablishment } from '../services/establishmentService';
import { cancelAppointment } from '../services/appointmentService'; // Corregido el import
import Card from '../components/ui/Card';
import AppointmentDetailModal from '../components/provider/AppointmentDetailModal';

// Imports de FullCalendar...
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
//import '@fullcalendar/common/main.css'; 
//import '@fullcalendar/daygrid/main.css';
//import '@fullcalendar/timegrid/main.css';


const ProviderAppointments = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const calendarRef = createRef();

  const fetchEvents = async (fetchInfo, successCallback, failureCallback) => {
    if (!establishmentId) { failureCallback(new Error("ID de establecimiento no proporcionado.")); return; }
    try {
      const startDate = fetchInfo.startStr.split('T')[0];
      const endDate = fetchInfo.endStr.split('T')[0];
      const appointments = await getAppointmentsForEstablishment(establishmentId, startDate, endDate);
      
      const events = appointments.map(appt => ({
        id: appt.id,
        title: `${appt.service.nombre} - ${appt.user.first_name || ''}`,
        start: appt.start_time,
        end: appt.end_time,
        backgroundColor: appt.estado === 'CONFIRMED' ? '#10B981' : '#EF4444',
        borderColor: appt.estado === 'CONFIRMED' ? '#059669' : '#DC2626',
        // --- GUARDAMOS EL OBJETO COMPLETO AQUÍ ---
        extendedProps: {
          fullAppointment: appt // Guardamos la cita completa
        }
      }));
      successCallback(events);
    } catch (error) {
      failureCallback(error);
    }
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleCancel = async (appointmentId) => {
    if (window.confirm('¿Estás seguro de que quieres cancelar esta cita?')) {
      try {
        await cancelAppointment(appointmentId);
        handleCloseModal();
        calendarRef.current.getApi().refetchEvents();
      } catch (error) {
        alert(`Error al cancelar la cita: ${error.message}`);
      }
    }
  };

  const handleReschedule = (appointment) => {
    handleCloseModal();
    const service = appointment.service;
    navigate(
      `/booking/${service.establishment.id}?reschedule_appointment_id=${appointment.id}&service_id=${service.id}`
    );
  };

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Agenda de Citas</h1>
        {establishmentName && <p>Mostrando agenda para: <strong>{establishmentName}</strong></p>}
      </header>
      
      <Card>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          locale={esLocale}
          events={fetchEvents}
          eventClick={handleEventClick}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
        />
      </Card>

      <AppointmentDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent} // Le pasamos el evento completo de FullCalendar
        onCancel={() => handleCancel(selectedEvent.id)}
        onReschedule={() => handleReschedule(selectedEvent.extendedProps.fullAppointment)}
      />
    </div>
  );
};
export default ProviderAppointments;