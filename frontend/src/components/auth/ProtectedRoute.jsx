// frontend/src/components/auth/ProtectedRoute.jsx
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, loading, reload } = useAuth();

  useEffect(() => {
    // Al entrar en una zona protegida, revalida estado (me + refresh silencioso si caducó)
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">Comprobando sesión…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search || ''}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}
