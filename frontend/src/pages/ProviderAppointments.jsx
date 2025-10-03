// frontend/src/pages/ProviderAppointments.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getAppointmentsForEstablishment } from '../services/establishmentService';
import { cancelAppointment } from '../services/appointmentService';
import { getBlackouts, createBlackout, deleteBlackout, updateBlackout } from '../services/calendarService';
import { getStaffForEstablishment, normalizeStaffList } from '../services/staffService';
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

const overlaps = (aStart, aEnd, bStart, bEnd) => {
  const norm = (t) => (t.length === 5 ? `${t}:00` : t);
  const toMin = (t) => {
    const [hh, mm, ss] = norm(t).split(':').map(Number);
    return hh * 60 + mm + (ss ? ss / 60 : 0);
  };
  const A0 = toMin(aStart);
  const A1 = toMin(aEnd);
  const B0 = toMin(bStart);
  const B1 = toMin(bEnd);
  return A0 < B1 && B0 < A1;
};

const fmtHM = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const startOfWeek = (d, startMonday = true) => {
  const date = new Date(d);
  const day = date.getDay(); // 0=Dom
  const diff = startMonday ? (day === 0 ? -6 : 1 - day) : -day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Paleta de colores por empleado
const STAFF_COLORS = [
  '#60A5FA', // azul
  '#F472B6', // rosa
  '#34D399', // verde
  '#F59E0B', // ámbar
  '#A78BFA', // violeta
  '#FB7185', // rojo claro
  '#22D3EE', // cian
  '#F97316', // naranja
];
const colorForStaffId = (staffId) => {
  if (staffId === undefined || staffId === null) return '#10B981'; // fallback (verde)
  const idx = Math.abs(Number(staffId)) % STAFF_COLORS.length;
  return STAFF_COLORS[idx];
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

  // --- Staff filter ---
  const [staffOptions, setStaffOptions] = useState([{ id: 'all', name: 'Todos' }]);
  const [staffFilter, setStaffFilter] = useState('all');

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

  // Selección (franja azul)
  const [preparedRange, setPreparedRange] = useState(null);

  // Edición inline
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('');

  // Duplicado
  const [dupEditingId, setDupEditingId] = useState(null);
  const [dupTargetDate, setDupTargetDate] = useState(toYYYYMMDD(new Date()));

  // Resaltado de conflictos
  const [selectedBlackout, setSelectedBlackout] = useState(null);

  // Crear semana entera
  const [wkBaseDate, setWkBaseDate] = useState(toYYYYMMDD(new Date()));
  const [wkIsFullDay, setWkIsFullDay] = useState(false);
  const [wkStart, setWkStart] = useState('10:00');
  const [wkEnd, setWkEnd] = useState('12:00');
  const [wkDays, setWkDays] = useState({
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
  });
  const [wkName, setWkName] = useState('');
  const [wkCat, setWkCat] = useState('event');

  // Bulk delete
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkIncludeFull, setBulkIncludeFull] = useState(true);
  const [bulkIncludePartial, setBulkIncludePartial] = useState(true);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modal handlers
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

  // Helpers de errores
  const toastFromError = (e, fallback) => {
    const status = e?.response?.status ?? e?.statusCode ?? e?.status;
    const serverMsg = e?.response?.data?.msg;
    const msg = serverMsg || e?.message || fallback;
    if (status === 409) toast.error(serverMsg || 'Conflicto: no se puede crear/editar el bloqueo.');
    else if (status === 403) toast.error(serverMsg || 'No tienes permisos sobre este establecimiento.');
    else if (status === 400) toast.error(msg || 'Solicitud inválida.');
    else toast.error(msg || fallback || 'Ha ocurrido un error.');
  };

  // Carga/refresh panel
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

  // Edición inline
  const startEdit = (b) => {
    setEditingId(b.id);
    setEditName(b.name || '');
    setEditCat(b.category || '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCat('');
  };
  const saveEdit = async (id) => {
    try {
      await updateBlackout(id, {
        ...(editName !== undefined ? { name: editName } : {}),
        ...(editCat !== undefined ? { category: editCat } : {}),
      });
      toast.success('Bloqueo actualizado.');
      cancelEdit();
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
    } catch (e) {
      toastFromError(e, 'No se pudo actualizar el bloqueo.');
    }
  };

  // === Conflictos con citas confirmadas ===
  const getCalendarAppointments = () => {
    const cal = calendarInstanceRef.current;
    if (!cal) return [];
    return cal
      .getEvents()
      .filter((e) => e.extendedProps?.kind === 'appointment')
      .map((e) => ({
        ref: e,
        start: e.start,
        end: e.end,
        estado: e.extendedProps?.fullAppointment?.estado || 'CONFIRMED',
        _origBg: e.backgroundColor,
        _origBorder: e.borderColor,
      }));
  };

  const countConflicts = (start, end) => {
    const appts = getCalendarAppointments().filter((a) => a.estado === 'CONFIRMED');
    let n = 0;
    for (const a of appts) if (start < a.end && a.start < end) n++;
    return n;
  };

  const clearHighlights = () => {
    const cal = calendarInstanceRef.current;
    if (!cal) return;
    cal.getEvents()
      .filter((e) => e.extendedProps?.kind === 'appointment')
      .forEach((e) => {
        const eb = e.extendedProps;
        if (eb && eb._origBg) e.setProp('backgroundColor', eb._origBg);
        if (eb && eb._origBorder) e.setProp('borderColor', eb._origBorder);
      });
    setSelectedBlackout(null);
  };

  const applyHighlightForBlackout = (blkEvent) => {
    const cal = calendarInstanceRef.current;
    if (!cal) return;

    // Toggle
    if (selectedBlackout && selectedBlackout.id === blkEvent.id) {
      clearHighlights();
      return;
    }

    clearHighlights();
    const start = blkEvent.start;
    const end = blkEvent.end;
    let count = 0;
    cal.getEvents()
      .filter((e) => e.extendedProps?.kind === 'appointment' && e.extendedProps?.fullAppointment?.estado === 'CONFIRMED')
      .forEach((e) => {
        if (start < e.end && e.start < end) {
          if (!e.extendedProps._origBg) {
            e.setExtendedProp('_origBg', e.backgroundColor);
            e.setExtendedProp('_origBorder', e.borderColor);
          }
          e.setProp('backgroundColor', '#93C5FD');
          e.setProp('borderColor', '#3B82F6');
          count++;
        }
      });

    if (count > 0) toast.success(`Resaltadas ${count} cita(s) confirmada(s) solapadas.`);
    else toast('No hay citas confirmadas solapadas.', { icon: 'ℹ️' });
    setSelectedBlackout(blkEvent);
  };

  // Drag/Resize de bloques manuales parciales
  const handleMoveResize = async (info) => {
    const ev = info.event;
    const raw = ev.extendedProps?.raw;
    const kind = ev.extendedProps?.kind;

    if (kind !== 'blackout' || !raw) return;
    const isHoliday = (raw.category || '').toLowerCase() === 'holiday';
    if (isHoliday || raw.is_full_day) {
      info.revert();
      toast.error('Este bloqueo no se puede mover/redimensionar.');
      return;
    }

    const start = ev.start;
    const end = ev.end;
    const startDate = toYYYYMMDD(start);
    const endDate = toYYYYMMDD(end);

    if (startDate !== endDate) {
      info.revert();
      toast.error('El bloqueo debe permanecer dentro del mismo día.');
      return;
    }
    if (end <= start) {
      info.revert();
      toast.error('La hora de fin debe ser mayor que la de inicio.');
      return;
    }

    const conflicts = countConflicts(start, end);
    if (conflicts > 0) {
      const ok = window.confirm(
        `Este bloqueo se solapa con ${conflicts} cita(s) confirmada(s). ¿Quieres guardarlo igualmente?`
      );
      if (!ok) {
        info.revert();
        return;
      }
    }

    try {
      await updateBlackout(raw.id, {
        date: startDate,
        start_time: fmtHM(start),
        end_time: fmtHM(end),
      });
      toast.success('Bloqueo actualizado.');
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
      if (selectedBlackout && selectedBlackout.id === ev.id) {
        applyHighlightForBlackout(ev);
      }
    } catch (e) {
      info.revert();
      toastFromError(e, 'No se pudo actualizar el bloqueo.');
    }
  };

  // === Cargar staff del establecimiento (independiente de citas visibles) ===
  useEffect(() => {
    let cancelled = false;
    const loadStaff = async () => {
      if (!establishmentId) return;
      try {
        const raw = await getStaffForEstablishment(establishmentId /*, { includeInactive: true } */);
        const normalized = normalizeStaffList(raw);
        const opts = [{ id: 'all', name: 'Todos' }, ...normalized];
        if (!cancelled) setStaffOptions(opts);
      } catch {
        if (!cancelled) setStaffOptions([{ id: 'all', name: 'Todos' }]);
      }
    };
    loadStaff();
    return () => { cancelled = true; };
  }, [establishmentId]);

  // Montar calendario
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
      selectable: true,
      selectMirror: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      eventOverlap: true,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
      views: {
        timeGridWeek: { slotMinTime: '07:00:00', slotMaxTime: '23:00:00' },
        timeGridDay: { slotMinTime: '07:00:00', slotMaxTime: '23:00:00' },
      },

      datesSet: (info) => {
        setRangeFrom(info.start);
        setRangeTo(info.end);
        clearHighlights();
        if (calendar) calendar.unselect?.();
        setPreparedRange(null);
      },

      dateClick: () => {
        clearHighlights();
      },

      select: (info) => {
        const start = info.start;
        const end = info.end;
        const date = toYYYYMMDD(start);
        const startHM = fmtHM(start);
        const endHM = fmtHM(end);
        setPreparedRange({ date, start: startHM, end: endHM });
        setPDate(date);
        setPStart(startHM);
        setPEnd(endHM);
      },

      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const startDate = fetchInfo.start.toISOString().split('T')[0];
          const endDate = fetchInfo.end.toISOString().split('T')[0];

          // Citas (pedimos al backend por staff cuando el filtro no es 'all')
          let appointments = await getAppointmentsForEstablishment(
            establishmentId,
            startDate,
            endDate,
            staffFilter && staffFilter !== 'all' ? staffFilter : null
          );

          // (Por compatibilidad) Si el backend aún no filtra por staffId, filtramos en cliente:
          if (staffFilter !== 'all') {
            const filterId = String(staffFilter);
            appointments = appointments.filter(a => String(a?.staff_member?.id || '') === filterId);
          }

          const apptEvents = appointments.map((appt) => {
            const staffName = appt.staff_member
              ? `${appt.staff_member.first_name || ''} ${appt.staff_member.last_name || ''}`.trim()
              : '';
            const titlePrefix = appt.service?.nombre || '';
            const clientName = appt.user?.first_name || '';

            let eventTitle = `${titlePrefix} - ${clientName}`;
            if (staffName) eventTitle += ` (con ${staffName})`;

            const sId = appt?.staff_member?.id;
            const bg = colorForStaffId(sId);
            const border = appt.estado === 'CONFIRMED' ? '#111827' : '#6B7280';

            return {
              id: `appt-${appt.id}`,
              title: eventTitle,
              start: appt.start_time,
              end: appt.end_time,
              backgroundColor: bg,
              borderColor: border,
              extendedProps: {
                fullAppointment: appt,
                kind: 'appointment',
                _origBg: bg,
                _origBorder: border,
                staffId: sId,
              },
            };
          });

          // Blackouts
          const blk = await getBlackouts({
            establishmentId,
            from: startDate,
            to: endDate,
          });

          const blackoutEvents = (Array.isArray(blk) ? blk : []).map((b) => {
            const isHoliday = (b.category || '').toLowerCase() === 'holiday';
            const isFull = !!b.is_full_day;
            const bgHoliday = '#9CA3AF';
            const bgManual = '#FBBF24';

            if (isFull) {
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
                backgroundColor: isHoliday ? bgHoliday : bgManual,
                editable: false,
                extendedProps: { kind: 'blackout', raw: b },
              };
            } else {
              const start = `${b.date}T${b.start_time}`;
              const end = `${b.date}T${b.end_time}`;

              if (isHoliday) {
                return {
                  id: `blk-${b.id}`,
                  title: b.name || `Bloqueo ${b.start_time}-${b.end_time}`,
                  start,
                  end,
                  allDay: false,
                  display: 'background',
                  backgroundColor: bgHoliday,
                  editable: false,
                  extendedProps: { kind: 'blackout', raw: b },
                };
              }

              return {
                id: `blk-${b.id}`,
                title: b.name || `Bloqueo ${b.start_time}-${b.end_time}`,
                start,
                end,
                allDay: false,
                backgroundColor: bgManual,
                borderColor: '#D97706',
                editable: true,
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
        const isBlackout = clickInfo?.event?.extendedProps?.kind === 'blackout';
        if (isBlackout) {
          applyHighlightForBlackout(clickInfo.event);
          return;
        }
        setSelectedEvent(clickInfo.event);
        setIsModalOpen(true);
      },

      eventDrop: handleMoveResize,
      eventResize: handleMoveResize,
    });

    calendarInstanceRef.current = calendar;
    calendar.render();

    return () => {
      calendarInstanceRef.current?.destroy();
      calendarInstanceRef.current = null;
    };
    // staffFilter depende para refetch de eventos
  }, [establishmentId, staffFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshBlackoutsPanel();
    if (rangeFrom && rangeTo) {
      setBulkFrom(toYYYYMMDD(rangeFrom));
      const endInc = new Date(rangeTo);
      endInc.setDate(endInc.getDate() - 1);
      setBulkTo(toYYYYMMDD(endInc));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, rangeFrom?.getTime(), rangeTo?.getTime()]);

  // === Conflictos helpers para crear ===
  const countConflictsPartial = (date, startHM, endHM) => {
    const [y, m, d] = date.split('-').map(Number);
    const toDate = (hm) => {
      const [H, M] = hm.split(':').map(Number);
      return new Date(y, m - 1, d, H, M, 0, 0);
    };
    return countConflicts(toDate(startHM), toDate(endHM));
  };
  const countConflictsFullDay = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return countConflicts(start, end);
  };

  // Crear blackouts
  const createFullDay = async () => {
    const hasPartial = blackouts.some((b) => b.date === fdDate && !b.is_full_day);
    if (hasPartial) {
      toast.error('Ya existen bloqueos parciales ese día. Elimina los parciales antes de crear un día completo.');
      return;
    }
    const conflicts = countConflictsFullDay(fdDate);
    if (conflicts > 0) {
      const ok = window.confirm(
        `Este bloqueo de día completo se solapa con ${conflicts} cita(s) confirmada(s). ¿Quieres crearlo igualmente?`
      );
      if (!ok) return;
    }

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
    const hasFullDay = blackouts.some((b) => b.date === pDate && b.is_full_day);
    if (hasFullDay) {
      toast.error('Ese día está bloqueado completo. Elimina el bloqueo de día completo antes de crear parciales.');
      return;
    }
    const overlapsPartial = blackouts.some(
      (b) => b.date === pDate && !b.is_full_day && overlaps(pStart, pEnd, b.start_time, b.end_time)
    );
    if (overlapsPartial) {
      toast.error('Ya existe un bloqueo parcial que se solapa con esa franja.');
      return;
    }
    const conflicts = countConflictsPartial(pDate, pStart, pEnd);
    if (conflicts > 0) {
      const ok = window.confirm(
        `Este bloqueo parcial se solapa con ${conflicts} cita(s) confirmada(s). ¿Quieres crearlo igualmente?`
      );
      if (!ok) return;
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
      if (preparedRange && preparedRange.date === pDate && preparedRange.start === pStart && preparedRange.end === pEnd) {
        setPreparedRange(null);
        const cal = calendarInstanceRef.current;
        cal?.unselect?.();
      }
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
    } catch (e) {
      toastFromError(e, 'No se pudo eliminar el blackout.');
    } finally {
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
      clearHighlights();
    }
  };

  // Crear directo desde la franja azul preparada
  const createFromPrepared = async () => {
    if (!preparedRange) return;
    setPDate(preparedRange.date);
    setPStart(preparedRange.start);
    setPEnd(preparedRange.end);
    await createPartial();
  };

  // Duplicar un blackout a otra fecha
  const duplicateBlackout = async (b) => {
    if (!dupTargetDate) {
      toast.error('Selecciona una fecha destino.');
      return;
    }

    try {
      if (b.is_full_day) {
        await createBlackout({
          establishmentId,
          date: dupTargetDate,
          isFullDay: true,
          name: b.name || 'Bloqueo',
          category: b.category || 'other',
        });
      } else {
        await createBlackout({
          establishmentId,
          date: dupTargetDate,
          isFullDay: false,
          startTime: b.start_time,
          endTime: b.end_time,
          name: b.name || `Bloqueo ${b.start_time}-${b.end_time}`,
          category: b.category || 'other',
        });
      }

      toast.success('Copia creada.');
      setDupEditingId(null);
      await refreshBlackoutsPanel();
      calendarInstanceRef.current?.refetchEvents();
    } catch (e) {
      toastFromError(e, 'No se pudo duplicar el bloqueo.');
    }
  };

  // Crear semana entera
  const toggleWkDay = (key) => setWkDays((s) => ({ ...s, [key]: !s[key] }));

  const createWeekBlocks = async () => {
    if (!wkBaseDate) {
      toast.error('Selecciona una fecha base.');
      return;
    }
    if (!wkIsFullDay && (!wkStart || !wkEnd || wkStart >= wkEnd)) {
      toast.error('Rellena una franja válida (inicio < fin).');
      return;
    }

    const base = new Date(wkBaseDate);
    const monday = startOfWeek(base, true); // lunes
    const selectedIdx = Object.entries(wkDays)
      .filter(([, v]) => v)
      .map(([k]) => ({ mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }[k]))
      .sort((a, b) => a - b);

    if (selectedIdx.length === 0) {
      toast.error('Selecciona al menos un día de la semana.');
      return;
    }

    const ops = [];
    for (const idx of selectedIdx) {
      const date = idx === 0 ? addDays(monday, 6) : addDays(monday, idx - 1);
      const dateStr = toYYYYMMDD(date);

      if (wkIsFullDay) {
        ops.push(() =>
          createBlackout({
            establishmentId,
            date: dateStr,
            isFullDay: true,
            name: wkName || 'Bloqueo',
            category: wkCat || 'other',
          })
        );
      } else {
        ops.push(() =>
          createBlackout({
            establishmentId,
            date: dateStr,
            isFullDay: false,
            startTime: wkStart,
            endTime: wkEnd,
            name: wkName || `Bloqueo ${wkStart}-${wkEnd}`,
            category: wkCat || 'other',
          })
        );
      }
    }

    let created = 0;
    let skipped = 0;
    for (const op of ops) {
      try {
        await op();
        created++;
      } catch (e) {
        skipped++;
      }
    }

    toast.success(`Semana: ${created} creado(s), ${skipped} omitido(s).`);
    await refreshBlackoutsPanel();
    calendarInstanceRef.current?.refetchEvents();
  };

  // === BULK DELETE ===
  const previewBulk = async () => {
    if (!bulkFrom || !bulkTo) {
      toast.error('Selecciona un rango de fechas.');
      return;
    }
    if (!establishmentId) return;
    setBulkLoading(true);
    try {
      const data = await getBlackouts({
        establishmentId,
        from: bulkFrom,
        to: bulkTo,
      });
      let list = Array.isArray(data) ? data : [];

      // filtros
      list = list.filter((b) => {
        if (!bulkIncludeFull && b.is_full_day) return false;
        if (!bulkIncludePartial && !b.is_full_day) return false;
        if (bulkCategory && (b.category || '').toLowerCase() !== bulkCategory.toLowerCase()) return false;
        return true;
      });

      setBulkPreview(list);
      toast.success(`Previsualización: ${list.length} bloqueo(s) encontrado(s).`);
    } catch (e) {
      toastFromError(e, 'No se pudo previsualizar el rango.');
    } finally {
      setBulkLoading(false);
    }
  };

  const runBulkDelete = async () => {
    if (bulkPreview.length === 0) {
      toast('No hay bloqueos para eliminar en la previsualización.');
      return;
    }
    const sure = window.confirm(
      `Vas a eliminar ${bulkPreview.length} bloqueo(s) entre ${bulkFrom} y ${bulkTo}. ¿Quieres continuar?`
    );
    if (!sure) return;

    let ok = 0;
    let fail = 0;
    for (const b of bulkPreview) {
      try {
        await deleteBlackout(b.id);
        ok++;
      } catch {
        fail++;
      }
    }

    toast.success(`Eliminados: ${ok}. Fallidos: ${fail}.`);
    setBulkPreview([]);
    await refreshBlackoutsPanel();
    calendarInstanceRef.current?.refetchEvents();
    clearHighlights();
  };

  // Conflictos calculados para la franja preparada
  const preparedConflicts = preparedRange
    ? countConflictsPartial(preparedRange.date, preparedRange.start, preparedRange.end)
    : 0;

  // Leyenda de colores por empleado
  const StaffLegend = useMemo(() => {
    if (!staffOptions || staffOptions.length <= 1) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {staffOptions
          .filter((o) => o.id !== 'all')
          .map((o) => (
            <span key={o.id} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs leading-none">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colorForStaffId(o.id) }} />
              <span className="whitespace-nowrap">{o.name}</span>
            </span>
          ))}
      </div>
    );
  }, [staffOptions]);

  return (
    <>
      <div className="page-wrapper">
        <header className="page-header">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1>Agenda de Citas</h1>
              {establishmentName && (
                <p className="truncate">
                  Mostrando agenda para: <strong>{establishmentName}</strong>
                </p>
              )}

              {/* Pill informativa de selección (franja azul) */}
              {preparedRange && (
                <div className="mt-2 inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs text-gray-700">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  <span className="whitespace-nowrap">
                    Franja preparada: {preparedRange.date} {preparedRange.start}-{preparedRange.end}
                  </span>
                  {preparedConflicts > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      • {preparedConflicts} conflicto{preparedConflicts !== 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="xs" onClick={createFromPrepared}>
                      Crear bloqueo parcial
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => {
                        setPreparedRange(null);
                        calendarInstanceRef.current?.unselect?.();
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtro por empleado */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Empleado</label>
                <select
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  value={staffFilter}
                  onChange={(e) => {
                    setStaffFilter(e.target.value);
                    calendarInstanceRef.current?.refetchEvents();
                  }}
                >
                  {staffOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón ajustes de festivos */}
              {establishmentId && (
                <Link
                  className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                  to={`/dashboard/provider/holiday-settings?est_id=${encodeURIComponent(
                    establishmentId
                  )}&name=${encodeURIComponent(establishmentName || '')}`}
                >
                  Ajustes de festivos
                </Link>
              )}

              {/* Leyenda compacta Festivo/Manual */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs leading-none"
                  title="Bloqueos automáticos sembrados (festivos)"
                >
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#9CA3AF' }} />
                  <span className="whitespace-nowrap">Festivo</span>
                </span>
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs leading-none"
                  title="Bloqueos manuales creados por ti"
                >
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#FBBF24' }} />
                  <span className="whitespace-nowrap">Manual</span>
                </span>
              </div>
            </div>
          </div>

          {/* Leyenda colores por empleado */}
          <div className="mt-3">{StaffLegend}</div>
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
                {blackouts.map((b) => {
                  const isEditing = editingId === b.id;
                  const isHoliday = (b.category || '').toLowerCase() === 'holiday';
                  const isDup = dupEditingId === b.id;

                  return (
                    <li key={b.id} className="py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm flex-1 min-w-0">
                          {!isEditing ? (
                            <>
                              <div className="font-medium truncate">
                                {b.date} {b.is_full_day ? '(día completo)' : `(${b.start_time}–${b.end_time})`}
                              </div>
                              {b.name && <div className="text-gray-600 truncate">{b.name}</div>}
                              {b.category && <div className="text-gray-400 truncate">{b.category}</div>}
                            </>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="text-xs text-gray-600">Nombre</label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  placeholder="Nombre del bloqueo"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600">Categoría</label>
                                <input
                                  type="text"
                                  value={editCat}
                                  onChange={(e) => setEditCat(e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  placeholder="holiday / event / other"
                                />
                              </div>
                              <div className="flex items-end gap-2">
                                <Button onClick={() => saveEdit(b.id)}>Guardar</Button>
                                <Button variant="secondary" onClick={cancelEdit}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="secondary"
                              onClick={() => startEdit(b)}
                              disabled={isHoliday}
                              title={isHoliday ? 'Los festivos automáticos no se pueden editar' : ''}
                            >
                              Editar
                            </Button>
                            <Button variant="danger" onClick={() => removeBlackout(b.id)}>
                              Eliminar
                            </Button>
                            {/* Duplicar */}
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setDupEditingId(isDup ? null : b.id);
                                setDupTargetDate(toYYYYMMDD(new Date(b.date)));
                              }}
                            >
                              Duplicar
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {/* Zona de duplicado */}
                      {isDup && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs text-gray-600">Fecha destino</label>
                            <input
                              type="date"
                              value={dupTargetDate}
                              onChange={(e) => setDupTargetDate(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button onClick={() => duplicateBlackout(b)}>Crear copia</Button>
                            <Button variant="secondary" onClick={() => setDupEditingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Bloquear semana entera */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Bloquear semana entera</h3>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Fecha base (para localizar la semana)</label>
                <input
                  type="date"
                  value={wkBaseDate}
                  onChange={(e) => setWkBaseDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se usará la semana de esta fecha (Lunes a Domingo).
                </p>
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Tipo</label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="wkType"
                      checked={wkIsFullDay}
                      onChange={() => setWkIsFullDay(true)}
                    />
                    <span>Día completo</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="wkType"
                      checked={!wkIsFullDay}
                      onChange={() => setWkIsFullDay(false)}
                    />
                    <span>Franja</span>
                  </label>
                </div>

                {!wkIsFullDay && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Inicio</label>
                      <input
                        type="time"
                        value={wkStart}
                        onChange={(e) => setWkStart(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Fin</label>
                      <input
                        type="time"
                        value={wkEnd}
                        onChange={(e) => setWkEnd(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Días de la semana</label>
                <div className="mt-1 grid grid-cols-4 gap-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.mon} onChange={() => setWkDays(s => ({ ...s, mon: !s.mon }))} />
                    <span>L</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.tue} onChange={() => setWkDays(s => ({ ...s, tue: !s.tue }))} />
                    <span>M</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.wed} onChange={() => setWkDays(s => ({ ...s, wed: !s.wed }))} />
                    <span>X</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.thu} onChange={() => setWkDays(s => ({ ...s, thu: !s.thu }))} />
                    <span>J</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.fri} onChange={() => setWkDays(s => ({ ...s, fri: !s.fri }))} />
                    <span>V</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.sat} onChange={() => setWkDays(s => ({ ...s, sat: !s.sat }))} />
                    <span>S</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={wkDays.sun} onChange={() => setWkDays(s => ({ ...s, sun: !s.sun }))} />
                    <span>D</span>
                  </label>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Nombre (opcional)</label>
                    <input
                      type="text"
                      value={wkName}
                      onChange={(e) => setWkName(e.target.value)}
                      placeholder={wkIsFullDay ? 'Bloqueo día completo' : 'Bloqueo franja'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Categoría</label>
                    <input
                      type="text"
                      value={wkCat}
                      onChange={(e) => setWkCat(e.target.value)}
                      placeholder="event / other"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <Button onClick={createWeekBlocks}>Crear bloqueos de la semana</Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Crear bloqueo (día completo) */}
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

          {/* Crear bloqueo (parcial) */}
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

          {/* === BULK DELETE (mejor visual) === */}
          <Card>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Eliminar bloqueos en lote</h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Desde</label>
                <input
                  type="date"
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Tipos</label>
                <div className="mt-1 flex flex-col gap-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={bulkIncludeFull}
                      onChange={() => setBulkIncludeFull(!bulkIncludeFull)}
                    />
                    <span>Día completo</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={bulkIncludePartial}
                      onChange={() => setBulkIncludePartial(!bulkIncludePartial)}
                    />
                    <span>Parcial</span>
                  </label>
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="text-xs text-gray-600">Categoría (opcional)</label>
                <input
                  type="text"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  placeholder="holiday / event / other"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="lg:col-span-12 flex items-center gap-2">
                <Button onClick={previewBulk} disabled={bulkLoading}>
                  {bulkLoading ? 'Previsualizando…' : 'Previsualizar'}
                </Button>
                <Button
                  variant="danger"
                  onClick={runBulkDelete}
                  disabled={bulkPreview.length === 0}
                  title={bulkPreview.length === 0 ? 'Haz una previsualización primero' : ''}
                >
                  Eliminar {bulkPreview.length > 0 ? `(${bulkPreview.length})` : ''}
                </Button>
              </div>
            </div>

            {bulkPreview.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-600">
                  <strong>Coincidencias:</strong> {bulkPreview.length}
                </p>
                <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {bulkPreview.map((b) => (
                    <li key={b.id} className="rounded-lg border px-3 py-2">
                      <div className="font-medium">
                        {b.date} {b.is_full_day ? '(día completo)' : `(${b.start_time}–${b.end_time})`}
                      </div>
                      {b.name && <div className="text-gray-600">{b.name}</div>}
                      {b.category && <div className="text-gray-400">{b.category}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
