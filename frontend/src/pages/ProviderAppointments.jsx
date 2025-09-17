// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAppointmentsForEstablishment } from '../services/establishmentService';
import { cancelAppointment } from '../services/appointmentService';
import { getBlackouts, createBlackout, deleteBlackout } from '../services/calendarService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import AppointmentDetailModal from '../components/provider/AppointmentDetailModal';

const toYYYYMMDD = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ProviderAppointments = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const calendarEl = useRef(null);
  const calendarInstanceRef = useRef(null);

  // Rango visible en el calendario (para listar blackouts en el panel)
  const [rangeFrom, setRangeFrom] = useState(null);
  const [rangeTo, setRangeTo] = useState(null);

  // Lista para el panel de blackouts
  const [blackouts, setBlackouts] = useState([]);
  const [loadingBlackouts, setLoadingBlackouts] = useState(false);

  // Formulario: blackout día completo
  const [fdDate, setFdDate] = useState(toYYYYMMDD(new Date()));
  const [fdName, setFdName] = useState('');
  const [fdCat, setFdCat] = useState('holiday');

  // Formulario: blackout parcial
  const [pDate, setPDate] = useState(toYYYYMMDD(new Date()));
  const [pStart, setPStart] = useState('10:00');
  const [pEnd, setPEnd] = useState('12:00');
  const [pName, setPName] = useState('');
  const [pCat, setPCat] = useState('event');

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
        handleCloseModal();
        calendarInstanceRef.current?.refetchEvents();
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

  // Helpers de errores para toasts
  const toastFromError = (e, fallback) => {
    const status = e?.response?.status ?? e?.statusCode ?? e?.status;
    const msg = e?.response?.data?.msg || e?.message || fallback;
    if (status === 409) toast.error('Ya existe un bloqueo igual para ese día.');
    else if (status === 403) toast.error('No tienes permisos sobre este establecimiento.');
    else if (status === 400) toast.error(msg || 'Solicitud inválida.');
    else toast.error(msg || fallback || 'Ha ocurrido un error.');
  };

  // Carga/refresh de la lista del panel de blackouts
  const refreshBlackoutsPanel = async () => {
    if (!establishmentId || !rangeFrom || !rangeTo) return;
    setLoadingBlackouts(true);
    try {
      const data = await getBlackouts({
        establishmentId,
        from: toYYYYMMDD(rangeFrom),
        to: toYYYYMMDD(rangeTo),
      });
      setBlackouts(Array.isArray(data) ? data : []);
    } catch (e) {
      toastFromError(e, 'No se pudieron cargar los bloques de calendario.');
    } finally {
      setLoadingBlackouts(false);
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

      // Actualiza el rango visible (para listar blackouts en el panel)
      datesSet: (info) => {
        setRangeFrom(info.start);
        setRangeTo(info.end);
      },

      // Carga citas + blackouts como "background events"
      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const startDate = fetchInfo.start.toISOString().split('T')[0];
          const endDate = fetchInfo.end.toISOString().split('T')[0];

          // 1) Citas
          const appointments = await getAppointmentsForEstablishment(
            establishmentId,
            startDate,
            endDate
          );

          const apptEvents = appointments.map((appt) => {
            const staffName = appt.staff_member
              ? `${appt.staff_member.first_name || ''} ${appt.staff_member.last_name || ''}`.trim()
              : '';
            const titlePrefix = appt.service?.nombre || '';
            const clientName = appt.user?.first_name || '';

            let eventTitle = `${titlePrefix} - ${clientName}`;
            if (staffName) eventTitle += ` (con ${staffName})`;

            return {
              id: `appt-${appt.id}`,
              title: eventTitle,
              start: appt.start_time,
              end: appt.end_time,
              backgroundColor: appt.estado === 'CONFIRMED' ? '#10B981' : '#EF4444',
              borderColor: appt.estado === 'CONFIRMED' ? '#059669' : '#DC2626',
              extendedProps: { fullAppointment: appt, kind: 'appointment' },
            };
          });

          // 2) Blackouts
          const blk = await getBlackouts({
            establishmentId,
            from: startDate,
            to: endDate,
          });

          const blackoutEvents = (Array.isArray(blk) ? blk : []).map((b) => {
            if (b.is_full_day) {
              // evento de fondo día completo [date, date+1)
              const start = `${b.date}T00:00:00`;
              const endDay = new Date(b.date);
              endDay.setDate(endDay.getDate() + 1);
              const end = `${toYYYYMMDD(endDay)}T00:00:00`;
              return {
                id: `blk-${b.id}`,
                title: b.name || 'Bloqueo',
                start,
                end,
                allDay: true,
                display: 'background',
                color: '#9CA3AF',
                extendedProps: { kind: 'blackout', raw: b },
              };
            } else {
              // parcial en el mismo día
              const start = `${b.date}T${b.start_time}`;
              const end = `${b.date}T${b.end_time}`;
              return {
                id: `blk-${b.id}`,
                title: b.name || `Bloqueo ${b.start_time}-${b.end_time}`,
                start,
                end,
                allDay: false,
                display: 'background',
                color: '#9CA3AF',
                extendedProps: { kind: 'blackout', raw: b },
              };
            }
          });

          successCallback([...apptEvents, ...blackoutEvents]);
        } catch (error) {
          console.error('Error cargando eventos para el calendario:', error);
          failureCallback(error);
        }
      },

      eventClick: (clickInfo) => {
        // Ignora clicks sobre eventos de blackout (fondo)
        if (clickInfo?.event?.extendedProps?.kind === 'blackout') return;
        setSelectedEvent(clickInfo.event);
        setIsModalOpen(true);
      },
    });

    calendarInstanceRef.current = calendar;
    calendar.render();

    return () => {
      calendarInstanceRef.current?.destroy();
      calendarInstanceRef.current = null;
    };
  }, [establishmentId]);

  // Cuando cambia el rango visible, refresca la lista del panel
  useEffect(() => {
    refreshBlackoutsPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, rangeFrom?.getTime(), rangeTo?.getTime()]);

  // Crear blackouts desde el panel
  const createFullDay = async () => {
    try {
      await createBlackout({
        establishmentId,
        date: fdDate,
        isFullDay: true,
        name: fdName || 'Bloqueo',
        category: fdCat || 'other',
      });
      toast.success('Bloqueo de día completo creado.');
      setFdName('');
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
    } catch (e) {
      toastFromError(e, 'No se pudo crear el blackout (día completo).');
    }
  };

  const createPartial = async () => {
    if (!pStart || !pEnd || pStart >= pEnd) {
      toast.error('La hora de inicio debe ser menor que la hora de fin.');
      return;
    }
    try {
      await createBlackout({
        establishmentId,
        date: pDate,
        isFullDay: false,
        startTime: pStart,
        endTime: pEnd,
        name: pName || `Bloqueo ${pStart}-${pEnd}`,
        category: pCat || 'other',
      });
      toast.success('Bloqueo parcial creado.');
      setPName('');
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
    } catch (e) {
      toastFromError(e, 'No se pudo crear el blackout parcial.');
    }
  };

  const removeBlackout = async (id) => {
    try {
      await deleteBlackout(id);
      toast.success('Bloqueo eliminado.');
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
    } catch (e) {
      toastFromError(e, 'No se pudo eliminar el blackout.');
    }
  };

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

        {/* Panel de bloqueos */}
        <div className="mt-6 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900">Bloqueos de calendario</h2>
            <p className="text-sm text-gray-600 mt-1">
              Rango visible: {rangeFrom ? toYYYYMMDD(rangeFrom) : '—'} → {rangeTo ? toYYYYMMDD(rangeTo) : '—'}
            </p>

            {loadingBlackouts ? (
              <p className="mt-3">Cargando…</p>
            ) : blackouts.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No hay bloqueos en este rango.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-200">
                {blackouts.map((b) => (
                  <li key={b.id} className="py-3 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">
                        {b.date}{' '}
                        {b.is_full_day ? '(día completo)' : `(${b.start_time}–${b.end_time})`}
                      </div>
                      {b.name && <div className="text-gray-600">{b.name}</div>}
                      {b.category && <div className="text-gray-400">{b.category}</div>}
                    </div>
                    <Button variant="danger" onClick={() => removeBlackout(b.id)}>
                      Eliminar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Crear bloqueo (día completo)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-600">Fecha</label>
                <input
                  type="date"
                  value={fdDate}
                  onChange={(e) => setFdDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Nombre (opcional)</label>
                <input
                  type="text"
                  value={fdName}
                  onChange={(e) => setFdName(e.target.value)}
                  placeholder="Festivo local"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Categoría</label>
                <input
                  type="text"
                  value={fdCat}
                  onChange={(e) => setFdCat(e.target.value)}
                  placeholder="holiday / event / other"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={createFullDay}>Crear</Button>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Crear bloqueo (parcial)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-gray-600">Fecha</label>
                <input
                  type="date"
                  value={pDate}
                  onChange={(e) => setPDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Inicio</label>
                <input
                  type="time"
                  value={pStart}
                  onChange={(e) => setPStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Fin</label>
                <input
                  type="time"
                  value={pEnd}
                  onChange={(e) => setPEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Nombre (opcional)</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Feria matinal"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Categoría</label>
                <input
                  type="text"
                  value={pCat}
                  onChange={(e) => setPCat(e.target.value)}
                  placeholder="event / maintenance"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={createPartial}>Crear</Button>
              </div>
            </div>
          </Card>
        </div>
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
