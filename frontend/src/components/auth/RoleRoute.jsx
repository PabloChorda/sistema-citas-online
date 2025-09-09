// frontend/src/components/auth/RoleRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function RoleRoute({ me, loading = false, allow = [] }) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[30vh] flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">Cargando…</div>
      </div>
    );
  }

  // Si no hay me, redirige a login preservando "from"
  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(me.role)) {
    // Usuario autenticado pero con rol incorrecto -> llévalo al dashboard raíz
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
