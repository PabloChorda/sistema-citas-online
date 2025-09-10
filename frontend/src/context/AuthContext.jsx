// frontend/src/context/AuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiGetJson, clearTokens, getAccessToken, setAccessToken, setRefreshToken } from '../api/http';

const AuthCtx = createContext({
  me: null,
  meLoading: false,
  isAuthenticated: false,
  login: async (_tokens) => {},   // 👈 añadido
  refreshMe: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);

  const refreshMe = useCallback(async () => {
    const at = getAccessToken();
    if (!at) {
      setMe(null);
      setMeLoading(false);
      return null;
    }
    setMeLoading(true);
    try {
      const data = await apiGetJson('/auth/me');
      setMe(data);
      return data;
    } catch {
      // Si hay 401 u otro error, dejamos me a null
      setMe(null);
      return null;
    } finally {
      setMeLoading(false);
    }
  }, []);

  // 👇 Nuevo: persistir tokens y actualizar `me`
  const login = useCallback(
    async ({ access_token, refresh_token }) => {
      // Persistimos tokens de forma unificada
      if (access_token) setAccessToken(access_token);
      if (refresh_token) setRefreshToken(refresh_token);

      // Notificamos a la app (otros listeners pueden reaccionar)
      try {
        window.dispatchEvent(new Event('storage'));
      } catch {}

      // Traemos el perfil actual (me) y lo devolvemos
      return await refreshMe();
    },
    [refreshMe]
  );

  const logout = useCallback(() => {
    clearTokens();
    setMe(null);
    try {
      // forzar reacciones en la misma pestaña
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }, []);

  // ¿Hay sesión? (se evalúa en cada render)
  const isAuthenticated = !!getAccessToken();

  // Cargar /auth/me al montar
  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Re-cargar /auth/me cuando cambien los tokens (otros puntos disparan el evento)
  useEffect(() => {
    const onStorage = () => { refreshMe(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshMe]);

  const value = useMemo(
    () => ({ me, meLoading, isAuthenticated, login, refreshMe, logout }),
    [me, meLoading, isAuthenticated, login, refreshMe, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
