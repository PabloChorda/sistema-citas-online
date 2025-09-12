// frontend/src/pages/ManageAvailability.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams, Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

import {
  getAvailability,
  createAvailabilityRule,
  deleteAvailabilityRule,
  updateAvailabilityRule,
} from '../services/availabilityService';

import AvailabilityModal from '../components/availability/AvailabilityModal';
import { PencilIcon, TrashIcon, PlusIcon, ClockIcon } from '@heroicons/react/24/outline';

const DAYS_OF_WEEK = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO',
];

const DayCardSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
    <div className="flex items-center justify-between">
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="h-9 w-28 rounded bg-gray-200" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-10 w-full rounded bg-gray-100" />
      <div className="h-10 w-full rounded bg-gray-100" />
      <div className="h-10 w-2/3 rounded bg-gray-100" />
    </div>
  </div>
);

export default function ManageAvailability() {
  const [searchParams] = useSearchParams();
  const establishmentId = searchParams.get('est_id');
  const establishmentName = searchParams.get('name');

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  // Forzamos remount del modal para limpiar campos tras crear
  const [modalKey, setModalKey] = useState(0);

  // Estado controlado de los acordeones por día
  // Inicialmente todo cerrado; se ajustará tras fetchear reglas
  const [openByDay, setOpenByDay] = useState({});

  const fetchAvailability = useCallback(async () => {
    if (!establishmentId) return;
    try {
      setLoading(true);
      const response = await getAvailability(establishmentId);
      setRules(response || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar la disponibilidad.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Agrupar por día y ordenar
  const rulesByDay = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = (rules || [])
        .filter((r) => r.dia_semana === day)
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      return acc;
    }, {});
  }, [rules]);

  // Mantener acordeones: abiertos si hay franjas; cerrados si no
  useEffect(() => {
    const next = {};
    for (const day of DAYS_OF_WEEK) {
      next[day] = (rulesByDay[day]?.length || 0) > 0;
    }
    setOpenByDay(next);
  }, [rulesByDay]);

  // Abrimos el día correspondiente cuando se cambia el seleccionado (para UX al crear)
  useEffect(() => {
    if (!selectedDay) return;
    setOpenByDay((prev) => ({ ...prev, [selectedDay]: true }));
  }, [selectedDay]);

  // Handlers
  const handleOpenModal = (day = null, rule = null) => {
    setSelectedDay(day);
    setRuleToEdit(rule);
    setIsModalOpen(true);
    // abre el acordeón del día inmediatamente (por si estaba cerrado)
    if (day) setOpenByDay((prev) => ({ ...prev, [day]: true }));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setRuleToEdit(null);
    setSelectedDay(null);
  };

  const handleSaveRule = async (formData) => {
    // Asegura que enviamos el día seleccionado si no viene en el form
    const payload = {
      ...formData,
      dia_semana: formData.dia_semana || selectedDay,
    };

    const isEdit = Boolean(ruleToEdit);
    const op = isEdit
      ? updateAvailabilityRule(ruleToEdit.id, payload)
      : createAvailabilityRule(establishmentId, payload);

    try {
      await toast.promise(op, {
        loading: 'Guardando horario...',
        success: '¡Horario guardado con éxito!',
        error: (err) => err.message || 'No se pudo guardar el horario.',
      });

      // ✅ Mantener el modal ABIERTO para añadir más franjas
      // Si era creación, reseteamos el modal forzando remount (limpia campos)
      if (!isEdit) {
        setModalKey((k) => k + 1);
      }

      // Refrescamos la lista; el efecto de rulesByDay abrirá/cerrará acordeones según contenido
      await fetchAvailability();

      // Notifica al onboarding de proveedor
      try {
        window.dispatchEvent(new Event('provider:availability:saved'));
      } catch {}
    } catch (err) {
      console.error('Fallo en handleSaveRule:', err);
    }
  };

  // Ahora recibe el objeto rule para conocer su día
  const handleDeleteRule = async (rule) => {
    if (!rule?.id) return;
    try {
      await toast.promise(deleteAvailabilityRule(rule.id), {
        loading: 'Eliminando…',
        success: 'Regla eliminada',
        error: (err) => err.message || 'No se pudo eliminar la regla.',
      });

      // Tras refrescar, el efecto de rulesByDay cerrará el día si queda vacío
      await fetchAvailability();

      try {
        window.dispatchEvent(new Event('provider:availability:saved'));
      } catch {}
    } catch (e) {
      console.error(e);
    }
  };

  // Render
  if (!establishmentId) {
    return (
      <div className="page-wrapper">
        <header className="page-header">
          <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestionar Disponibilidad</h1>
        </header>
        <Card className="p-8">
          <p className="text-gray-700">Error: Falta el ID del establecimiento en la URL.</p>
          <Link
            to="/dashboard/provider/establishments"
            className="mt-4 inline-block font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Volver a mis establecimientos
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <header className="page-header sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <h1 className="text-2xl font-semibold text-gray-900 m-0">Gestionar Disponibilidad</h1>
        <p className="text-gray-600 mt-1">
          Establecimiento:{' '}
          <strong>{establishmentName ? decodeURIComponent(establishmentName) : `ID ${establishmentId}`}</strong>
        </p>
        <p className="text-gray-600">
          Define tus horarios de trabajo recurrentes. Estos se usarán para generar los huecos de cita.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <DayCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card>
          <p className="p-4 text-red-600">{error}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {DAYS_OF_WEEK.map((day) => {
            const dayRules = rulesByDay[day] || [];
            const dayLabel = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();

            return (
              <details
                key={day}
                open={!!openByDay[day]}
                className="rounded-xl border border-gray-200 bg-white shadow-card"
              >
                <summary
                  className="flex list-none cursor-pointer items-center justify-between gap-2 px-4 py-3"
                  onClick={(e) => {
                    // Gestionamos manualmente el toggle del <details>
                    e.preventDefault();
                    setOpenByDay((prev) => ({ ...prev, [day]: !prev[day] }));
                  }}
                >
                  <h3 className="text-base font-semibold text-gray-900">{dayLabel}</h3>
                  <div className="flex items-center gap-2">
                    {/* Botón añadir franja en el summary (sin contar franjas) */}
                    <Button
                      variant="secondarySoft"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault(); // evita cerrar/abrir el details
                        handleOpenModal(day);
                      }}
                      className="md:mr-1"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Añadir franja</span>
                      <span className="sm:hidden">Añadir</span>
                    </Button>
                  </div>
                </summary>

                <div className="px-4 pb-4">
                  {dayRules.length > 0 ? (
                    <ul
                      className="
                        mt-1 space-y-2
                        max-h-[42vh] overflow-y-auto pr-1
                        md:max-h-none md:overflow-visible
                      "
                    >
                      {dayRules.map((rule) => (
                        <li
                          key={rule.id}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ClockIcon className="h-4 w-4 text-gray-500 shrink-0" />
                            <p className="truncate text-sm font-medium text-gray-900">
                              {rule.hora_inicio?.slice(0, 5)} — {rule.hora_fin?.slice(0, 5)}
                            </p>
                            {rule.intervalo_minutos ? (
                              <span className="ml-2 shrink-0 rounded-full bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 text-[11px]">
                                cada {rule.intervalo_minutos}’
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleOpenModal(day, rule)}
                              className="text-brand-600 hover:text-brand-700"
                              title="Editar franja"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => handleDeleteRule(rule)}
                              className="text-danger hover:text-red-700"
                              title="Eliminar franja"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                      No hay franjas para este día.
                    </div>
                  )}

                  {/* Botón extra full-width en móvil */}
                  <div className="mt-3 md:hidden">
                    <Button className="w-full" onClick={() => handleOpenModal(day)}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Añadir franja
                    </Button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <AvailabilityModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveRule}
        ruleToEdit={ruleToEdit}
        day={selectedDay}
      />
    </div>
  );
}
