// frontend/src/components/auth/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ token }) => {
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />; // Outlet renderiza las rutas anidadas
}; 

export default ProtectedRoute;