// frontend/src/pages/BookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

import { useBooking } from '../context/BookingContext';
import { getAvailableSlots, getPublicEstablishmentDetails } from '../services/establishmentService';
import { rescheduleAppointment } from '../services/appointmentService';
import Button from '../components/ui/Button'; // Importamos el botón para los slots

const toYYYYMMDD = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const BookingPage = () => {
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setBookingInfo } = useBooking();

  // Leemos los parámetros de la URL para el modo de reprogramación
  const appointmentToRescheduleId = searchParams.get('reschedule_appointment_id');
  const serviceIdToLock = searchParams.get('service_id');
  const isRescheduleMode = !!appointmentToRescheduleId;
  
  const [establishment, setEstablishment] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  // Efecto para cargar los datos del establecimiento y pre-seleccionar el servicio si es necesario
  useEffect(() => {
    const fetchEstablishmentData = async () => {
      setError('');
      setEstablishment(null);
      try {
        setLoading(true);
        const data = await getPublicEstablishmentDetails(establishmentId);
        setEstablishment(data);

        // Si estamos en modo reprogramación, encontramos y fijamos el servicio
        if (isRescheduleMode && data.services) {
          const serviceToLock = data.services.find(s => s.id === parseInt(serviceIdToLock));
          if (serviceToLock) {
            setSelectedService(serviceToLock);
          }
        }
      } catch (err) {
        setError("No se pudo cargar la información del establecimiento.");
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishmentData();
  }, [establishmentId, isRescheduleMode, serviceIdToLock]);

  // Efecto para cargar los horarios (sin cambios)
  useEffect(() => {
    if (selectedService && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        setError('');
        setAvailableSlots([]);
        try {
          const dateStr = toYYYYMMDD(selectedDate);
          const slots = await getAvailableSlots(establishmentId, selectedService.id, dateStr);
          setAvailableSlots(slots);
        } catch (err) {
          setError(err.message || 'No se pudieron cargar los horarios.');
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [selectedService, selectedDate, establishmentId]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setAvailableSlots([]);
  };

  const handleServiceChange = (e) => {
    const serviceId = parseInt(e.target.value);
    if (establishment && establishment.services) {
      const service = establishment.services.find(s => s.id === serviceId);
      setSelectedService(service);
      setAvailableSlots([]);
    }
  };

  const handleSlotClick = async (slot) => {
    // Si estamos en modo reprogramación...
    if (isRescheduleMode) {
      if (window.confirm(`¿Confirmas que quieres mover la cita a esta nueva hora: ${slot}?`)) {
        try {
          const dateStr = toYYYYMMDD(selectedDate);
          const newStartTimeISO = new Date(`${dateStr}T${slot}:00`).toISOString();
          
          await rescheduleAppointment(appointmentToRescheduleId, newStartTimeISO);
          
          alert("¡Cita reprogramada con éxito!");

          // --- LÓGICA DE REDIRECCIÓN CORREGIDA ---
          // 1. Leemos el rol del usuario actual desde localStorage
          const currentUserRole = localStorage.getItem('userRole');

          // 2. Decidimos a dónde redirigir basándonos en el rol
          if (currentUserRole === 'provider') {
            // Si es un proveedor, lo mandamos a su agenda
            navigate(`/dashboard/provider/appointments?est_id=${establishmentId}&name=${encodeURIComponent(establishment.nombre)}`);
          } else {
            // Si es un cliente (o cualquier otra cosa), lo mandamos a su página "Mis Citas"
            navigate('/dashboard/client/appointments');
          }

        } catch (err) {
          alert(`Error al reprogramar: ${err.message}`);
        }
      }
    } else {
      // Si estamos en modo reserva normal, usamos el contexto
      const bookingData = { 
        establishment,
        service: selectedService, 
        date: toYYYYMMDD(selectedDate), 
        slot 
      };
      setBookingInfo(bookingData);
      navigate('/booking/confirm');
    }
  };

  if (loading) return <div className="page-wrapper"><p>Cargando...</p></div>;
  if (error && !establishment) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;
  if (!establishment) return <div className="page-wrapper"><p>Establecimiento no encontrado.</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>{isRescheduleMode ? 'Reprogramar Cita' : `Reservar Cita en ${establishment.nombre}`}</h1>
        <p>{isRescheduleMode ? `Selecciona una nueva fecha y hora para el servicio: ${selectedService?.nombre}` : 'Sigue los pasos para encontrar tu hueco perfecto.'}</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="profile-card">
            <h2 className="text-xl font-bold mb-4">1. Servicio Seleccionado</h2>
            <select 
              onChange={handleServiceChange} 
              className="w-full p-2 border border-gray-300 rounded-md" 
              value={selectedService?.id || ''}
              disabled={isRescheduleMode}
            >
              <option value="" disabled>-- Selecciona un servicio --</option>
              {establishment.services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.nombre} ({service.duracion_minutos} min) - {service.precio}€
                </option>
              ))}
            </select>
            {isRescheduleMode && <p className="text-sm text-gray-500 mt-2">Para cambiar el servicio, por favor, cancela la cita y crea una nueva.</p>}
          </div>
          {selectedService && (
            <div className="profile-card">
              <h2 className="text-xl font-bold mb-4">2. Elige una Fecha</h2>
              <div className="flex justify-center">
                <Calendar 
                  onChange={handleDateChange} 
                  value={selectedDate} 
                  minDate={new Date()}
                />
              </div>
            </div>
          )}
        </div>
        <div className="md:col-span-1">
          {selectedService && selectedDate && (
            <div className="profile-card">
              <h2 className="text-xl font-bold mb-4">3. Elige una Hora</h2>
              <p className="text-sm text-gray-600 mb-4">
                Horarios para el {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {loadingSlots && <p>Buscando horarios...</p>}
              {!loadingSlots && !error && (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <Button 
                        key={slot} 
                        onClick={() => handleSlotClick(slot)} 
                        variant="outline"
                        className="w-full"
                      >
                        {slot}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-gray-500">No hay huecos disponibles.</p>
                  )}
                </div>
              )}
              {error && !loadingSlots && <p className="error-message">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingPage;