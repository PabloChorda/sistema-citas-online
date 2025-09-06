// src/hooks/useIdentity..js
import { useEffect, useState, useCallback } from 'react';
import { fetchMe } from '../services/authService';

export default function useIdentity() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMe();
      setMe(data);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar /auth/me');
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { me, loading, error, refreshMe: load };
}
