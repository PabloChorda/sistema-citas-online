// frontend/src/pages/ProviderDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProviderDashboardSummary } from '../services/dashboardService';
import { getProviderProfile } from '../services/providerService';

const StatCard = ({ title, value, linkTo, linkText }) => (
  <div className="bg-white rounded-lg shadow p-4 sm:p-6 w-full">
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
    {linkTo && (
      <div className="mt-4">
        <Link
          to={linkTo}
          className="text-sm font-semibold text-brand-500 hover:text-brand-600 hover:underline"
        >
          {linkText} →
        </Link>
      </div>
    )}
  </div>
);

const TodayAppointmentItem = ({ appointment }) => (
  <li className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
    <div className="text-left">
      <p className="text-base font-medium text-gray-800">{appointment.service?.nombre}</p>
      <p className="text-sm text-gray-500">
        con {appointment.user?.first_name} {appointment.user?.last_name}
      </p>
    </div>
    <span className="text-sm font-semibold text-gray-700">
      {new Date(appointment.start_time).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })}
    </span>
  </li>
);

const ProviderDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [defaultEstId, setDefaultEstId] = useState(null);
  const [defaultEstName, setDefaultEstName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga perfil (para elegir est_id por defecto) y resumen
  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);

        // 1) Perfil proveedor → elegir establecimiento por defecto
        const profile = await getProviderProfile();
        const ests = profile?.establishments || [];
        const est =
          ests.find((e) => e.is_default) ||
          ests[0] ||
          null;

        setDefaultEstId(est?.id ?? null);
        setDefaultEstName(est?.nombre ?? '');

        // 2) Resumen (si tu API soporta est_id, pásalo; si no, filtramos localmente)
        const data = await getProviderDashboardSummary(/* { est_id: est?.id } */);
        setSummary(data);
      } catch (err) {
        console.error(err);
        setError('No se pudo cargar el resumen del dashboard.');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  // Filtra las citas de hoy al establecimiento por defecto (si no viene filtrado del backend)
  const todayAppointmentsFiltered = useMemo(() => {
    const list = summary?.today_appointments || [];
    if (!defaultEstId) return list;
    return list.filter((a) => {
      // Intenta leer el establecimiento desde service.establishment_id o appointment.establishment_id
      const fromService = a?.service?.establishment_id;
      const direct = a?.establishment_id;
      return (fromService ?? direct) === defaultEstId;
    });
  }, [summary, defaultEstId]);

  if (loading) {
    return (
      <div className="page-wrapper px-4">
        <p className="text-gray-500">Cargando dashboard...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-wrapper px-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper px-4">
      <header className="page-header mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
        <p className="text-sm text-gray-500">
          {defaultEstName ? `Establecimiento: ${defaultEstName}` : 'Resumen rápido de tu actividad reciente.'}
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard
          title="Citas para Hoy"
          value={todayAppointmentsFiltered.length}
          linkTo={
            defaultEstId
              ? `/dashboard/provider/appointments?est_id=${defaultEstId}&name=${encodeURIComponent(
                  defaultEstName || ''
                )}`
              : '/dashboard/provider/establishments'
          }
          linkText="Ver agenda completa"
        />
        <StatCard
          title="Próximas Citas (7 días)"
          value={summary?.upcoming_week_count || 0}
        />
      </section>

      <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Agenda de Hoy</h2>
        {todayAppointmentsFiltered.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {todayAppointmentsFiltered.map((appt) => (
              <TodayAppointmentItem key={appt.id} appointment={appt} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No tienes citas programadas para hoy.</p>
        )}
      </section>

      {summary?.latest_booking && (
        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Última Reserva Recibida</h2>
          <p className="text-sm">
            <strong>{summary.latest_booking.service?.nombre}</strong> para{' '}
            <strong>{summary.latest_booking.user?.first_name}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Reservado el{' '}
            {new Date(summary.latest_booking.created_at).toLocaleString('es-ES')}
          </p>
        </section>
      )}
    </div>
  );
};

export default ProviderDashboard;
