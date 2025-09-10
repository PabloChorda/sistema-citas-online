// frontend/src/components/auth/RoleRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleRoute({ allow }) {
  const { isAuthenticated, me, meLoading } = useAuth();
  const location = useLocation();

  if (meLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">Comprobando permisos…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!me) {
    // caso raro: sin me pero autenticado → fuerza login
    return <Navigate to="/login" replace />;
  }

  if (allow && me.role !== allow) {
    // rol incorrecto → a dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
