// frontend/src/hooks/useAuthMe.js
import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { getAccessToken } from '../api/http';

export default function useAuthMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken(); // si no hay token, no llamamos
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient('/auth/me', 'GET');
      setMe(data || null);
    } catch {
      // si falla (401, red, etc.), me = null
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // primera carga
  useEffect(() => {
    load();
  }, [load]);

  // cuando cambian los tokens (disparamos un storage event en App),
  // recarga el /auth/me
  useEffect(() => {
    const onStorage = () => load();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [load]);

  return { me, loading, refreshMe: load };
}
