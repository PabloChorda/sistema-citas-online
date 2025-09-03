// src/components/auth/ProtectedRoute.jsx
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { getAccessToken, getRefreshToken } from '../../api/http';

export default function ProtectedRoute() {
  const location = useLocation();
  const at = getAccessToken();
  const rt = getRefreshToken();

  // Si hay access o refresh, deja pasar: los fetch protegidos harán refresh si hace falta.
  if (at || rt) return <Outlet />;

  // Sin ningún token -> a login con “next”
  return <Navigate to="/login" state={{ from: location }} replace />;
}
