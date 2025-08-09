// frontend/src/pages/BookingPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

import { useBooking } from '../context/BookingContext';
import { getAvailableSlots, getPublicEstablishmentDetails } from '../services/establishmentService';
import { getPublicStaffForEstablishment } from '../services/staffService';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

// Util: YYYY-MM-DD
const toYYYYMMDD = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

  // Datos iniciales
  useEffect(() => {
    const fetchInitial = async () => {
      setError('');
      try {
        setLoading(true);
        const est = await getPublicEstablishmentDetails(establishmentId);
        setEstablishment(est);

        if (est?.has_multiple_staff) {
          const staff = await getPublicStaffForEstablishment(establishmentId);
          setAvailableStaff(staff || []);
        }

        if (isRescheduleMode && est?.services) {
          const locked = est.services.find(s => s.id === Number(serviceIdToLock));
          if (locked) setSelectedService(locked);
        }
      } catch (e) {
        console.error(e);
        setError('No se pudo cargar la información inicial.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [establishmentId, isRescheduleMode, serviceIdToLock]);

  // Cargar horarios por fecha + servicio (+ staff opcional)
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedService || !selectedDate) return;
      setLoadingSlots(true);
      setError('');
      setAvailableSlots([]);
      try {
        const dateStr = toYYYYMMDD(selectedDate);
        const staffId = selectedStaffId === 'any' ? null : Number(selectedStaffId);
        const slots = await getAvailableSlots(establishmentId, selectedService.id, dateStr, staffId);
        setAvailableSlots(slots || []);
      } catch (e) {
        console.error(e);
        setError(e.message || 'No se pudieron cargar los horarios.');
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [selectedService, selectedDate, establishmentId, selectedStaffId]);

  // Handlers
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setAvailableSlots([]);
  };

  const handleServiceChange = (e) => {
    const id = Number(e.target.value);
    setSelectedStaffId('any');
    const svc = establishment?.services?.find(s => s.id === id) || null;
    setSelectedService(svc);
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
      staffId: selectedStaffId === 'any' ? null : Number(selectedStaffId),
      availableStaff,
    };

    if (isRescheduleMode) {
      // Aquí integraríais reschedule cuando esté listo
      setBookingInfo(bookingData);
      navigate('/booking/confirm');
    } else {
      setBookingInfo(bookingData);
      navigate('/booking/confirm');
    }
  };

  // Filtro de staff que puede realizar el servicio
  const staffForService = useMemo(() => {
    if (!availableStaff || !selectedService) return [];
    return availableStaff.filter(
      s => Array.isArray(s.service_ids) && s.service_ids.includes(selectedService.id)
    );
  }, [availableStaff, selectedService]);

  if (loading) return <div className="page-wrapper"><p>Cargando…</p></div>;
  if (error && !establishment) return <div className="page-wrapper"><p className="error-message">{error}</p></div>;
  if (!establishment) return <div className="page-wrapper"><p>Establecimiento no encontrado.</p></div>;

  const showStaffStep = establishment.has_multiple_staff && selectedService && staffForService.length > 0;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">
          {isRescheduleMode ? 'Reprogramar Cita' : `Reservar Cita en ${establishment.nombre}`}
        </h1>
        <p className="text-gray-600 mt-1">
          {isRescheduleMode
            ? `Selecciona una nueva fecha y hora para: ${selectedService?.nombre || 'tu servicio'}`
            : 'Sigue los pasos para encontrar tu hueco perfecto.'}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Columna izquierda */}
        <div className="md:col-span-2 space-y-8">
          {/* Paso 1: Servicio */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Elige un servicio</h2>
            <select
              onChange={handleServiceChange}
              value={selectedService?.id || ''}
              disabled={isRescheduleMode}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>— Selecciona un servicio —</option>
              {establishment.services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.duracion_minutos} min) · {Number(s.precio).toFixed(2)} €
                </option>
              ))}
            </select>
            {isRescheduleMode && (
              <p className="text-xs text-gray-500 mt-2">
                Para cambiar el servicio, cancela y crea una nueva cita.
              </p>
            )}
          </Card>

          {/* Paso 2: Staff (opcional) */}
          {showStaffStep && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Elige un profesional (opcional)</h2>
              <select
                onChange={handleStaffChange}
                value={selectedStaffId}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              >
                <option value="any">Con cualquier profesional</option>
                {staffForService.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.first_name} {st.last_name} ({st.rol})
                  </option>
                ))}
              </select>
            </Card>
          )}

          {/* Paso 3: Fecha */}
          {selectedService && (
            <Card>
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
                {showStaffStep ? '3.' : '2.'} Elige una fecha
              </h2>

              <div className="flex justify-center py-2 md:py-0">
                <Calendar
                  onChange={handleDateChange}
                  value={selectedDate}
                  minDate={new Date()}
                  locale="es-ES"
                  next2Label={null}
                  prev2Label={null}
                  tileDisabled={({ date, view }) => {
                    if (!selectedService) return true;
                    if (view !== 'month') return false;
                    // Desactivar días pasados
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const d = new Date(date);
                    d.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                  tileClassName={({ date, view }) => {
                    if (view !== 'month') return '';
                    const isToday = new Date().toDateString() === date.toDateString();
                    return ['rounded-md', isToday ? 'ring-1 ring-brand-500' : ''].join(' ');
                  }}
                />
              </div>
            </Card>
          )}
        </div>

        {/* Columna derecha: horarios */}
        <div className="md:col-span-1">
          {selectedService && selectedDate && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {showStaffStep ? '4.' : '3.'} Elige una hora
              </h2>
              <p className="text-xs text-gray-600 mb-4">
                {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>

              {loadingSlots && <p>Buscando horarios…</p>}

              {!loadingSlots && !error && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableSlots.length > 0 ? (
                    availableSlots.map(slot => (
                      <Button
                        key={slot}
                        onClick={() => handleSlotClick(slot)}
                        variant="secondarySoft"
                        className="w-full py-2"
                      >
                        {slot}
                      </Button>
                    ))
                  ) : (
                    <p className="col-span-2 md:col-span-3 text-center text-gray-500">No hay huecos disponibles.</p>
                  )}
                </div>
              )}

              {error && !loadingSlots && <p className="error-message mt-3">{error}</p>}
            </Card>
          )}
        </div>
      </div>

      {/* Overrides visuales para react-calendar + ajustes mobile */}
      <style>{`
        .react-calendar {
          width: 100%;
          border: none;
          background: transparent;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }
        .react-calendar__navigation {
          display: flex;
          margin-bottom: 0.5rem;
        }
        .react-calendar__navigation button {
          min-width: 36px;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #111827;
        }
        .react-calendar__navigation button:enabled:hover {
          background: #f3f4f6;
        }
        .react-calendar__month-view__weekdays {
          text-transform: capitalize;
          font-weight: 600;
          color: #6b7280;
          font-size: 12px;
        }
        .react-calendar__tile {
          padding: 10px 6px;
          border-radius: 8px;
        }
        .react-calendar__tile:enabled:hover {
          background: #E6F4FB; /* brand-50 */
        }
        .react-calendar__tile--active {
          background: #0077C0 !important; /* brand-500 */
          color: white !important;
        }
        .react-calendar__tile--now {
          background: #F4F5F6; /* primary-50 */
        }
        .react-calendar__tile--now:enabled:hover {
          background: #E6F4FB; /* brand-50 */
        }
        .react-calendar__tile:disabled {
          background: transparent;
          color: #d1d5db;
        }

        /* ====== móvil <640px ====== */
        @media (max-width: 640px) {
          .react-calendar {
            font-size: 13px; /* baja un punto el tamaño general */
          }
          .react-calendar__navigation {
            margin-bottom: 0.25rem; /* menos separación */
          }
          .react-calendar__navigation button {
            min-width: 32px;
            padding: 4px 6px;      /* más compacto */
            border-radius: 6px;
            font-size: 13px;
          }
          .react-calendar__month-view__weekdays {
            font-size: 11px;       /* días de la semana más pequeños */
          }
          .react-calendar__tile {
            padding: 6px 4px;      /* tiles más pequeños */
            border-radius: 6px;
            line-height: 1.1;
          }
          .react-calendar__tile--active {
            box-shadow: 0 0 0 1px rgba(0,0,0,0.04) inset;
          }
        }
      `}</style>
    </div>
  );
};

export default BookingPage;
