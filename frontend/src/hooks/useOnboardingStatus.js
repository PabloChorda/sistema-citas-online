// frontend/src/hooks/useOnboardingStatus.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getProviderProfile } from '../services/providerService';

const ONBOARDING_EVT = 'provider:onboarding:refresh';

export default function useOnboardingStatus() {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const fetchingRef = useRef(false);

  const refetch = async () => {
    if (fetchingRef.current) return; // evita solapamientos
    fetchingRef.current = true;
    try {
      setError('');
      if (!initialized) setLoading(true); // solo bloquea antes de la 1ª carga
      const p = await getProviderProfile();
      setProfile(p || null);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el perfil del proveedor');
    } finally {
      setLoading(false);
      setInitialized(true);
      fetchingRef.current = false;
    }
  };

  // Primera carga
  useEffect(() => { refetch(); /* eslint-disable-next-line */ }, []);

  // Revalida al cambiar de ruta
  useEffect(() => { if (initialized) refetch(); /* eslint-disable-next-line */ }, [location.pathname, location.search]);

  // Revalida al volver a la pestaña
  useEffect(() => {
    const onFocus = () => initialized && refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [initialized]);

  // Revalida si alguien dispara el evento manual
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener(ONBOARDING_EVT, onRefresh);
    return () => window.removeEventListener(ONBOARDING_EVT, onRefresh);
  }, []);

  const steps = useMemo(() => {
    const p = profile || {};
    const establishments = Array.isArray(p.establishments) ? p.establishments : [];
    const needsBusinessData = !p.nombre_comercial || !p.cif || !p.direccion_fiscal;
    const hasNoEstablishments = establishments.length === 0;

    let hasAnyService = false;
    for (const est of establishments) {
      const services = Array.isArray(est?.services) ? est.services : [];
      if (services.length > 0) { hasAnyService = true; break; }
    }
    const hasNoServicesAnyEst = !hasAnyService;

    // si aún no tenéis disponibilidad, mantenlo en true hasta implementar
    const hasNoAvailability = true;

    return { needsBusinessData, hasNoEstablishments, hasNoServicesAnyEst, hasNoAvailability };
  }, [profile]);

  const isDone = useMemo(() => {
    if (!profile) return false;
    const s = steps;
    return !s.needsBusinessData && !s.hasNoEstablishments && !s.hasNoServicesAnyEst && !s.hasNoAvailability;
  }, [profile, steps]);

  return { loading, initialized, error, profile, steps, isDone, refetch };
}
