// frontend/src/pages/BookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

import { useBooking } from '../context/BookingContext';
// --- IMPORTACIONES CORREGIDAS ---
import { getAvailableSlots, getPublicEstablishmentDetails } from '../services/establishmentService';
import { getPublicStaffForEstablishment } from '../services/staffService'; // Usamos la nueva función pública
import { rescheduleAppointment } from '../services/appointmentService';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

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

  const appointmentToRescheduleId = searchParams.get('reschedule_appointment_id');
  const serviceIdToLock = searchParams.get('service_id');
  const isRescheduleMode = !!appointmentToRescheduleId;
  
  const [establishment, setEstablishment] = useState(null);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState('any');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  // Efecto para cargar los datos iniciales
  useEffect(() => {
    const fetchInitialData = async () => {
      setError('');
      try {
        setLoading(true);
        const estData = await getPublicEstablishmentDetails(establishmentId);
        setEstablishment(estData);

        if (estData.has_multiple_staff) {
          // --- LLAMADA A LA API CORREGIDA ---
          const staffData = await getPublicStaffForEstablishment(establishmentId);
          setAvailableStaff(staffData || []);
        }

        if (isRescheduleMode && estData.services) {
          const serviceToLock = estData.services.find(s => s.id === parseInt(serviceIdToLock));
          if (serviceToLock) setSelectedService(serviceToLock);
        }
      } catch (err) {
        setError("No se pudo cargar la información inicial.");
        console.error("Error en fetchInitialData:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [establishmentId, isRescheduleMode, serviceIdToLock]);

  // Efecto para cargar los horarios
  useEffect(() => {
    if (selectedService && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        setError('');
        setAvailableSlots([]);
        try {
          const dateStr = toYYYYMMDD(selectedDate);
          const staffId = selectedStaffId === 'any' ? null : selectedStaffId;
          const slots = await getAvailableSlots(establishmentId, selectedService.id, dateStr, staffId);
          setAvailableSlots(slots);
        } catch (err) {
          setError(err.message || 'No se pudieron cargar los horarios.');
        } finally {
          setLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [selectedService, selectedDate, establishmentId, selectedStaffId]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setAvailableSlots([]);
  };

  const handleServiceChange = (e) => {
    const serviceId = parseInt(e.target.value);
    setSelectedStaffId('any');
    if (establishment?.services) {
      const service = establishment.services.find(s => s.id === serviceId);
      setSelectedService(service);
    }
    setAvailableSlots([]);
  };
  
  const handleStaffChange = (e) => {
    setSelectedStaffId(e.target.value);
    setAvailableSlots([]);
  };

  const handleSlotClick = (slot) => {
    const bookingData = { 
      establishment,
      service: selectedService, 
      date: toYYYYMMDD(selectedDate), 
      slot,
      staffId: selectedStaffId === 'any' ? null : parseInt(selectedStaffId),
      availableStaff: availableStaff 
    };

    if (isRescheduleMode) {
      // Lógica de reprogramación (simplificada para el ejemplo)
      const dateStr = toYYYYMMDD(selectedDate);
      const newStartTimeISO = new Date(`${dateStr}T${slot}:00`).toISOString();
      // ... la lógica de reprogramación completa va aquí ...
      console.log("Reprogramando con:", { appointmentToRescheduleId, newStartTimeISO });
    } else {
      setBookingInfo(bookingData);
      navigate('/booking/confirm');
    }
  };
  
  // Filtramos el personal que puede realizar el servicio seleccionado
  const staffForService = availableStaff.filter(
    staff => selectedService && staff.service_ids && Array.isArray(staff.service_ids) && staff.service_ids.includes(selectedService.id)
  );
  
  if (loading) return <div className="page-wrapper"><p>Cargando...</p></div>;
  if (error && !establishment) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;
  if (!establishment) return <div className="page-wrapper"><p>Establecimiento no encontrado.</p></div>;

  const showStaffStep = establishment.has_multiple_staff && selectedService && staffForService.length > 0;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>{isRescheduleMode ? 'Reprogramar Cita' : `Reservar Cita en ${establishment.nombre}`}</h1>
        <p>{isRescheduleMode ? `Selecciona una nueva fecha y hora para: ${selectedService?.nombre}` : 'Sigue los pasos para encontrar tu hueco perfecto.'}</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <h2 className="text-xl font-bold mb-4">1. Elige un Servicio</h2>
            <select onChange={handleServiceChange} value={selectedService?.id || ''} disabled={isRescheduleMode} className="w-full p-2 border border-gray-300 rounded-md">
              <option value="" disabled>-- Selecciona un servicio --</option>
              {establishment.services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.nombre} ({service.duracion_minutos} min) - {service.precio}€
                </option>
              ))}
            </select>
            {isRescheduleMode && <p className="text-sm text-gray-500 mt-2">Para cambiar el servicio, cancela y crea una nueva cita.</p>}
          </Card>

          {showStaffStep && (
            <Card>
              <h2 className="text-xl font-bold mb-4">2. Elige un Profesional (Opcional)</h2>
              <select onChange={handleStaffChange} value={selectedStaffId} className="w-full p-2 border border-gray-300 rounded-md">
                <option value="any">Con cualquier profesional</option>
                {staffForService.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name} {staff.last_name} ({staff.rol})
                  </option>
                ))}
              </select>
            </Card>
          )}

          {selectedService && (
            <Card>
              <h2 className="text-xl font-bold mb-4">{showStaffStep ? '3.' : '2.'} Elige una Fecha</h2>
              <div className="flex justify-center">
                <Calendar onChange={handleDateChange} value={selectedDate} minDate={new Date()} />
              </div>
            </Card>
          )}
        </div>
        <div className="md:col-span-1">
          {selectedService && selectedDate && (
            <Card>
              <h2 className="text-xl font-bold mb-4">{showStaffStep ? '4.' : '3.'} Elige una Hora</h2>
              <p className="text-sm text-gray-600 mb-4">
                Horarios para el {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {loadingSlots && <p>Buscando horarios...</p>}
              {!loadingSlots && !error && (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <Button key={slot} onClick={() => handleSlotClick(slot)} variant="outline" className="w-full">{slot}</Button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-gray-500">No hay huecos disponibles.</p>
                  )}
                </div>
              )}
              {error && !loadingSlots && <p className="error-message">{error}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingPage;