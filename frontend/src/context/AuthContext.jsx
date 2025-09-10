// frontend/src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGetJson, clearTokens, getAccessToken } from '../api/http';

const AuthCtx = createContext({
  me: null,
  meLoading: false,
  isAuthenticated: false,
  bootstrapping: true,
  refreshMe: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const refreshMe = useCallback(async () => {
    const at = getAccessToken();
    if (!at) {
      setMe(null);
      return null;
    }
    setMeLoading(true);
    try {
      const data = await apiGetJson('/auth/me');
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setMeLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setMe(null);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }, []);

  const isAuthenticated = !!getAccessToken();

  // Primera carga con splash
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    const MIN = 400; // ms

    (async () => {
      try {
        await refreshMe();
      } finally {
        if (!alive) return;
        const elapsed = Date.now() - started;
        const wait = Math.max(0, MIN - elapsed);
        setTimeout(() => {
          if (alive) setBootstrapping(false);
        }, wait);
      }
    })();

    // Fallback duro por si algo se cuelga (3s)
    const hard = setTimeout(() => alive && setBootstrapping(false), 3000);
    return () => {
      alive = false;
      clearTimeout(hard);
    };
  }, [refreshMe]);

  // Re-cargar /auth/me cuando cambien tokens (otros puntos disparan 'storage')
  useEffect(() => {
    const onStorage = () => { refreshMe(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshMe]);

  const value = useMemo(
    () => ({ me, meLoading, isAuthenticated, bootstrapping, refreshMe, logout }),
    [me, meLoading, isAuthenticated, bootstrapping, refreshMe, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
