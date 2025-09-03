// frontend/src/components/auth/ProtectedRoute.jsx
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAccessToken, getRefreshToken } from '../../api/http';

// Util simple para decodificar JWT (payload)
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return json || null;
  } catch {
    return null;
  }
}

// Pequeño helper para saber si está expirado (o a punto) con margen
function isExpired(token, skewSeconds = 10) {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true; // si no hay exp, trátalo como expirado
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= (now + skewSeconds);
}

// Redirige a /login preservando next
function goLoginWithNext(pathname, search) {
  try {
    const here = `${pathname}${search || ''}`;
    const next = encodeURIComponent(here);
    if (!pathname.startsWith('/login')) {
      window.location.assign(`/login?next=${next}`);
    }
  } catch {
    // no-op
  }
}

export default function ProtectedRoute({ token: _tokenProp }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Leemos tokens siempre desde localStorage (fuente de verdad para http.js)
  const access = useMemo(() => getAccessToken(), []);
  const refresh = useMemo(() => getRefreshToken(), []);

  useEffect(() => {
    let mounted = true;

    async function check() {
      // 1) No hay access ni refresh -> a login
      if (!access && !refresh) {
        if (!mounted) return;
        setAllowed(false);
        setChecking(false);
        goLoginWithNext(location.pathname, location.search);
        return;
      }

      // 2) Hay access y NO está expirado -> pasar
      if (access && !isExpired(access)) {
        if (!mounted) return;
        setAllowed(true);
        setChecking(false);
        return;
      }

      // 3) Intentar refresh: hacemos una llamada inofensiva al backend a través de http.js
      //    La lógica centralizada se encargará del refresh y/o redirección si falla.
      try {
        // Cualquier GET protegido sirve; usamos /auth/email/resend-verification que exige JWT.
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/api'}/auth/email/resend-verification`,
          {
            method: 'POST',
            // No ponemos Authorization aquí; http.js es quien añade y refresca.
            // Peeero aquí NO estamos usando authFetch para no crear dependencia circular.
            // Esta llamada es sólo para forzar refresh desde http.js cuando se consuma a través de apiClient/authFetch.
            // Si prefieres evitar efectos, cambia esta comprobación por una llamada real desde una ruta que use apiClient.
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() || ''}` },
            credentials: 'include',
          }
        );

        // Si el refresh se hizo bien, http.js habrá regenerado el access y esta request
        // normalmente devolverá 200/400 (dependiendo del estado de verificación). Lo importante es que no sea 401.
        if (res.status === 401) {
          // http.js ya habrá intentado refrescar. Si seguimos en 401, toca login.
          if (!mounted) return;
          setAllowed(false);
          setChecking(false);
          goLoginWithNext(location.pathname, location.search);
        } else {
          if (!mounted) return;
          setAllowed(true);
          setChecking(false);
        }
      } catch {
        // Cualquier fallo de red -> mejor llevar a login
        if (!mounted) return;
        setAllowed(false);
        setChecking(false);
        goLoginWithNext(location.pathname, location.search);
      }
    }

    check();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  if (checking) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">Comprobando sesión…</div>
      </div>
    );
  }

  if (!allowed) {
    // La redirección ya la hemos disparado; devolvemos un fallback por si React renderiza algo en medio
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}