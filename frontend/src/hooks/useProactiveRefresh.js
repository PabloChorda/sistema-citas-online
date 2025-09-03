// src/hooks/useProactiveRefresh.js
import { useEffect, useRef } from 'react';
import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken, // <- exportado por ../api/http
} from '../api/http';

// Decodifica payload del JWT
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
function getExp(token) {
  const p = decodeJwt(token);
  return p?.exp || null;
}

/**
 * Refresca silenciosamente el access token antes de que caduque.
 * - leadSeconds: margen en segundos para refrescar antes de expirar (p.ej. 90s)
 * - minInterval: intervalo de seguridad para re-chequear (p.ej. 60s)
 */
export default function useProactiveRefresh({ leadSeconds = 90, minInterval = 60 } = {}) {
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const schedule = () => {
    clearTimers();

    const rt = getRefreshToken();
    if (!rt) return; // sin refresh no programamos nada

    const at = getAccessToken();
    const exp = getExp(at);
    if (!exp) return; // sin exp no programamos

    const now = Math.floor(Date.now() / 1000);
    const fireIn = Math.max(0, (exp - leadSeconds) - now);

    const triggerRefresh = async () => {
      try {
        await refreshAccessToken(); // si falla, http.js ya manejará el 401 en la próxima request
      } catch {
        // silencio; próximo fetch decidirá (apiClient redirigirá si corresponde)
      } finally {
        // reprograma con el nuevo access token
        schedule();
      }
    };

    if (fireIn <= 0) {
      // ya estamos dentro de la ventana -> refresca ya
      triggerRefresh();
    } else {
      timeoutRef.current = setTimeout(triggerRefresh, fireIn * 1000);
    }

    // Intervalo de seguridad por si el token cambia fuera de nuestro control
    const safeInterval = Math.max(15, minInterval);
    intervalRef.current = setInterval(() => {
      const at2 = getAccessToken();
      const exp2 = getExp(at2);
      if (!exp2) return;
      const now2 = Math.floor(Date.now() / 1000);
      if (exp2 - now2 <= leadSeconds) {
        triggerRefresh();
      }
    }, safeInterval * 1000);
  };

  useEffect(() => {
    schedule();

    const onFocus = () => {
      // al volver a la pestaña, intenta refrescar si estamos cerca
      const at = getAccessToken();
      const exp = getExp(at);
      const now = Math.floor(Date.now() / 1000);
      if (exp && exp - now <= leadSeconds) {
        refreshAccessToken().finally(schedule);
      }
    };

    const onStorage = (e) => {
      // si cambian tokens en otra pestaña, reprograma
      if (['access_token', 'accessToken', 'refresh_token', 'refreshToken'].includes(e.key)) {
        schedule();
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimers();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadSeconds, minInterval]);
}
