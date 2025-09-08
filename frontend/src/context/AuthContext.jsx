// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { getAccessToken, clearTokens } from '../api/http';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function fetchMe() {
    const at = getAccessToken();
    if (!at) {
      setMe(null);
      setLoading(false);
      setError('');
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const data = await apiClient('/auth/me', 'GET');
      setMe(data ?? null);
    } catch (e) {
      // Si /me falla (p. ej. 401 tras refresh), considera sesión caída
      setMe(null);
      setError(e?.message || 'No se pudo obtener el perfil');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  // 1) cargar al montar
  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) reintentar cuando cambie el access_token (mismo tab)
  useEffect(() => {
    const onStorage = (ev) => {
      if (ev.key === 'access_token' || ev.key === 'accessToken') {
        fetchMe();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    try { clearTokens(); } catch {}
    setMe(null);
    setError('');
  };

  const value = {
    me,
    setMe,
    loading,
    error,
    isAuthenticated: Boolean(me?.user_id),
    logout,
    reload: fetchMe,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
