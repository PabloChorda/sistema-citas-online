import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProviderProfile } from '../../services/providerService';
import { useAuth } from '../../context/AuthContext';

export default function ProviderOnboardingBanner() {
  const { me } = useAuth();
  const userId = me?.user_id ?? 'anon';

  const HIDE_KEY = `onboarding_hide_provider_${userId}`;   // “no volver a mostrar”
  const SNOOZE_KEY = `onboarding_snooze_provider_${userId}`; // “ocultar hoy (24h)”

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  // ---- helpers persistencia ----
  const isHiddenForever = () => {
    try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  };
  const isSnoozedNow = () => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || '0');
      return Date.now() < until;
    } catch { return false; }
  };
  const snooze24h = () => {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {}
  };
  const hideForever = () => {
    try { localStorage.setItem(HIDE_KEY, '1'); } catch {}
  };

  // ---- fetch perfil / progreso ----
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProviderProfile();
      setProfile(p || null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (isHiddenForever() || isSnoozedNow()) return; // ni siquiera consultamos si está oculto
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Revalidar cuando otras pantallas avisen cambios
  useEffect(() => {
    const onRefresh = () => {
      if (!isHiddenForever() && !isSnoozedNow()) {
        fetchProfile();
      }
    };
    window.addEventListener('provider:onboarding:refresh', onRefresh);
    window.addEventListener('provider:availability:saved', onRefresh);
    window.addEventListener('provider:staff:changed', onRefresh);
    return () => {
      window.removeEventListener('provider:onboarding:refresh', onRefresh);
      window.removeEventListener('provider:availability:saved', onRefresh);
      window.removeEventListener('provider:staff:changed', onRefresh);
    };
  }, [fetchProfile, userId]);

  const {
    hasEstablishment,
    hasServices,
    hasAvailability,
    hasStaff,
    firstEstId,
  } = useMemo(() => {
    const ests = profile?.establishments || [];
    const firstId = ests[0]?.id ?? null;

    const servicesOk = ests.some(
      (e) =>
        (Array.isArray(e?.services) && e.services.length > 0) ||
        (typeof e?.services_count === 'number' && e.services_count > 0)
    );
    const staffOk = ests.some(
      (e) =>
        (Array.isArray(e?.staff) && e.staff.length > 0) ||
        (typeof e?.staff_count === 'number' && e.staff_count > 0)
    );
    const availabilityOk = ests.some(
      (e) =>
        e?.availability_configured === true ||
        e?.has_availability === true ||
        (Array.isArray(e?.opening_hours) && e.opening_hours.length > 0)
    );

    return {
      hasEstablishment: ests.length > 0,
      hasServices: servicesOk,
      hasAvailability: availabilityOk,
      hasStaff: staffOk,
      firstEstId: firstId,
    };
  }, [profile]);

  // Ocultaciones y auto-ocultación
  if (loading) return null;
  if (isHiddenForever() || isSnoozedNow()) return null;
  if (!profile) return null;
  if (profile?.onboarding_done === true) return null;

  const allDone = hasEstablishment && hasServices && hasAvailability;
  if (allDone) return null;

  // Enlaces dependientes del primer establecimiento
  const estNewUrl = '/dashboard/provider/establishments/new';
  const estListUrl = '/dashboard/provider/establishments';
  const servicesUrl = firstEstId
    ? `/dashboard/provider/services?est_id=${firstEstId}`
    : estListUrl;
  const availabilityUrl = firstEstId
    ? `/dashboard/provider/availability?est_id=${firstEstId}`
    : estListUrl;
  const staffUrl = firstEstId
    ? `/dashboard/provider/staff?est_id=${firstEstId}`
    : estListUrl;

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            ¡Bienvenido! Configura tu cuenta de proveedor
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Completa estos pasos para empezar a recibir reservas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { snooze24h(); window.dispatchEvent(new Event('provider:onboarding:refresh')); }}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            title="Ocultar durante 24 horas"
          >
            Ocultar hoy
          </button>
          <button
            type="button"
            onClick={() => { hideForever(); window.dispatchEvent(new Event('provider:onboarding:refresh')); }}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            title="No volver a mostrar"
          >
            No volver a mostrar
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Paso 1: Establecimiento */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">Primer establecimiento</div>
          <div className="mt-1 text-sm text-gray-600">Crea al menos un local.</div>
          <div className="mt-2">
            {hasEstablishment ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                ✓ Listo
              </span>
            ) : (
              <Link
                to={estNewUrl}
                className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Crear
              </Link>
            )}
          </div>
        </div>

        {/* Paso 2: Servicios */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">Añadir servicios</div>
          <div className="mt-1 text-sm text-gray-600">Publica lo que ofreces.</div>
          <div className="mt-2">
            {hasServices ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                ✓ Listo
              </span>
            ) : (
              <Link
                to={servicesUrl}
                className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Añadir
              </Link>
            )}
          </div>
        </div>

        {/* Paso 3: Disponibilidad */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">Configurar disponibilidad</div>
          <div className="mt-1 text-sm text-gray-600">Define tus horarios.</div>
          <div className="mt-2">
            {hasAvailability ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border-emerald-200 border">
                ✓ Listo
              </span>
            ) : (
              <Link
                to={availabilityUrl}
                className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Configurar
              </Link>
            )}
          </div>
        </div>

        {/* Paso 4: Personal (opcional) */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">Invitar personal</div>
          <div className="mt-1 text-sm text-gray-600">Asigna empleados (opcional).</div>
          <div className="mt-2">
            {hasStaff ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border-emerald-200 border">
                ✓ Listo
              </span>
            ) : (
              <Link
                to={staffUrl}
                className="inline-flex items-center rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Invitar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
