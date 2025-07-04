// frontend/src/pages/BookingPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 

// Importamos las funciones de nuestro servicio
import { getAvailableSlots, getPublicEstablishmentDetails } from '../services/establishmentService';

const BookingPage = () => {
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  
  const [establishment, setEstablishment] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');

  // Efecto para cargar los detalles del establecimiento y sus servicios desde la API
  useEffect(() => {
    const fetchEstablishmentData = async () => {
      // Reiniciamos el error y los datos cada vez que cambia el ID
      setError('');
      setEstablishment(null);
      try {
        setLoading(true);
        // LLAMADA REAL A LA API para obtener los detalles públicos
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

  // Efecto que se dispara cuando el usuario elige un servicio o una fecha
  useEffect(() => {
    // Solo se ejecuta si tenemos un servicio y una fecha seleccionados
    if (selectedService && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true);
        setError(''); // Limpiamos errores de horarios anteriores
        setAvailableSlots([]);
        try {
          const dateStr = selectedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
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
    // Limpiamos los slots al cambiar de fecha para forzar una nueva búsqueda
    setAvailableSlots([]);
  };

  const handleServiceChange = (e) => {
    const serviceId = parseInt(e.target.value);
    if (establishment && establishment.services) {
      const service = establishment.services.find(s => s.id === serviceId);
      setSelectedService(service);
      // Limpiamos los slots al cambiar de servicio
      setAvailableSlots([]);
    }
  };

  const handleSlotClick = (slot) => {
    // Navegamos a la página de confirmación, pasando los datos necesarios
    navigate('/booking/confirm', { 
      state: { 
        establishment,
        service: selectedService, 
        date: selectedDate.toISOString().split('T')[0],
        slot 
      } 
    });
  };

  // --- Lógica de Renderizado ---
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
                  minDate={new Date()} // No permite seleccionar fechas pasadas
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