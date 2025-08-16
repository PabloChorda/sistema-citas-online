// frontend/src/pages/ProviderDashboard.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProviderDashboardSummary } from '../services/dashboardService';
import { getProviderProfile } from '../services/providerService';
import { createWhatsappInvite } from "../services/whatsappInviteService";
import ShareInviteByWhatsApp from '../components/provider/ShareInviteByWhatsApp';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';

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

  // NUEVO estado para invitaciones
  const [phone, setPhone] = useState('');
  const [nextPath, setNextPath] = useState('/');
  const [ttl, setTtl] = useState(60);
  const [inviteUrl, setInviteUrl] = useState('');

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

        // 2) Resumen
        const data = await getProviderDashboardSummary();
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

  // Filtra las citas de hoy
  const todayAppointmentsFiltered = useMemo(() => {
    const list = summary?.today_appointments || [];
    if (!defaultEstId) return list;
    return list.filter((a) => {
      const fromService = a?.service?.establishment_id;
      const direct = a?.establishment_id;
      return (fromService ?? direct) === defaultEstId;
    });
  }, [summary, defaultEstId]);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Introduce un teléfono en formato E.164 (ej: +34600111222)");
      return;
    }
    try {
      const { inviteUrl } = await createWhatsappInvite(
        phone.trim(),
        Number(ttl) || 60,
        nextPath || "/"
      );
      setInviteUrl(inviteUrl);
      toast.success("Invitación creada");
    } catch (err) {
      toast.error(err.message || "Error creando invitación");
    }
  };

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
        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
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

      {/* Nueva sección: Invitaciones por WhatsApp */}
      <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Invitar por WhatsApp</h2>
        <form onSubmit={handleCreateInvite} className="grid gap-3 md:grid-cols-3 items-end">
          <label className="text-sm">
            <span className="block mb-1">Teléfono (E.164)</span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34600111222"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1">Ruta siguiente (next)</span>
            <Input
              value={nextPath}
              onChange={(e) => setNextPath(e.target.value)}
              placeholder="/booking/123"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1">TTL (minutos)</span>
            <Input
              type="number"
              min={1}
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              placeholder="60"
            />
          </label>

          <div className="md:col-span-3">
            <Button type="submit" variant="primary">Generar enlace</Button>
          </div>
        </form>

        {inviteUrl && (
          <div className="mt-4 space-y-2">
            <p className="text-sm break-all">
              Enlace generado:{" "}
              <a className="text-indigo-600 underline" href={inviteUrl} target="_blank" rel="noreferrer">
                {inviteUrl}
              </a>
            </p>
            <ShareInviteByWhatsApp inviteUrl={inviteUrl} />
          </div>
        )}
      </section>
    </div>
  );
};

export default ProviderDashboard;
