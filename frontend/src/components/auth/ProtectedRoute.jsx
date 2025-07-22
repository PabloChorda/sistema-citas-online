// frontend/src/components/auth/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ token }) => {
  const location = useLocation(); // Obtiene la ubicación actual

  if (!token) {
    // Si no hay token, redirige al login.
    // **LA CLAVE:** `state` pasa información a la nueva ruta.
    // Le estamos diciendo: "Recuerda que el usuario intentaba ir a 'location'".
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si hay token, permite el acceso a las rutas anidadas
  return <Outlet />;
};

export default ProtectedRoute;