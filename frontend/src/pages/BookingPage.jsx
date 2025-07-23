// frontend/src/pages/BookingPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

import { useBooking } from '../context/BookingContext';
import { getAvailableSlots, getPublicEstablishmentDetails } from '../services/establishmentService';

/**
 * Convierte un objeto Date de JavaScript a un string YYYY-MM-DD
 * de forma segura, evitando conversiones automáticas a UTC.
 * Esto asegura que la fecha que el usuario selecciona es la que se envía.
 */
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
  const { setBookingInfo } = useBooking();
  
  const [establishment, setEstablishment] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEstablishmentData = async () => {
      setError('');
      setEstablishment(null);
      try {
        setLoading(true);
        const data = await getPublicEstablishmentDetails(establishmentId);
        setEstablishment(data);
      } catch (err) {
        setError("No se pudo cargar la información del establecimiento. Puede que no exista o esté inactivo.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishmentData();
  }, [establishmentId]);

  useEffect(() => {
    if (selectedService && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        setError('');
        setAvailableSlots([]);
        try {
          // --- CAMBIO CLAVE: Usamos la función segura para formatear la fecha ---
          const dateStr = toYYYYMMDD(selectedDate);
          const slots = await getAvailableSlots(establishmentId, selectedService.id, dateStr);
          setAvailableSlots(slots);
        } catch (err) {
          setError(err.message || 'No se pudieron cargar los horarios para esta fecha.');
          console.error(err);
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

  const handleSlotClick = (slot) => {
    const bookingData = { 
      establishment,
      service: selectedService, 
      // --- CAMBIO CLAVE: Guardamos la fecha en formato seguro ---
      // Guardamos el string YYYY-MM-DD para evitar problemas de zona horaria al pasarlo a la siguiente página.
      date: toYYYYMMDD(selectedDate), 
      slot 
    };
    
    setBookingInfo(bookingData);
    navigate('/booking/confirm');
  };

  if (loading) return <div className="page-wrapper"><p>Cargando información del local...</p></div>;
  if (error) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;
  if (!establishment) return <div className="page-wrapper"><p>Establecimiento no encontrado.</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Reservar Cita en {establishment.nombre}</h1>
        <p>Sigue los pasos para encontrar tu hueco perfecto.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="profile-card">
            <h2 className="text-xl font-bold mb-4">1. Elige un Servicio</h2>
            <select onChange={handleServiceChange} className="w-full p-2 border border-gray-300 rounded-md" defaultValue="">
              <option value="" disabled>-- Selecciona un servicio --</option>
              {establishment.services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.nombre} ({service.duracion_minutos} min) - {service.precio}€
                </option>
              ))}
            </select>
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
                Mostrando horarios para el {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
              </p>
              {loadingSlots && <p>Buscando horarios...</p>}
              {!loadingSlots && !error && (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <button 
                        key={slot} 
                        onClick={() => handleSlotClick(slot)} 
                        className="p-2 border rounded-md text-center bg-indigo-100 text-indigo-800 hover:bg-indigo-600 hover:text-white"
                      >
                        {slot}
                      </button>
                    ))
                  ) : (
                    <p className="col-span-3 text-center text-gray-500">No hay huecos disponibles para este día.</p>
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