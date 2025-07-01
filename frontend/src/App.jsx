// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/Login.css'; // Asegúrate de que la ruta a tu CSS sea correcta

// Layouts y Páginas
import DashboardLayout from './layouts/DashboardLayout.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';
import ProviderProfile from './pages/ProviderProfile';
import ClientProfile from './pages/ClientProfile'; // <-- 1. Importamos la nueva página

function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [role, setRole] = useState(localStorage.getItem('userRole'));

  useEffect(() => {
    // Sincroniza el estado de React si el localStorage cambia (ej: en otra pestaña)
    const handleStorageChange = () => {
      setToken(localStorage.getItem('accessToken'));
      setRole(localStorage.getItem('userRole'));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  const handleLogin = (newToken, newRole) => {
    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('userRole', newRole);
    setToken(newToken);
    setRole(newRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
    setToken(null);
    setRole(null);
  };

  return (
    <Router>
      <Routes>
        {!token ? (
          // --- RUTAS PÚBLICAS (cuando no hay token) ---
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            {/* Cualquier otra ruta redirige al login si no se está autenticado */}
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          // --- RUTAS PRIVADAS (cuando SÍ hay token) ---
          // Todas las rutas privadas están dentro del DashboardLayout
          <Route path="/" element={<DashboardLayout handleLogout={handleLogout} />}>
            <Route index element={<WelcomeDashboard />} />
            
            {/* --- RUTAS CONDICIONALES POR ROL --- */}
            {role === 'provider' && (
              <Route path="provider/profile" element={<ProviderProfile />} />
            )}
            
            {role === 'client' && (
              <Route path="client/profile" element={<ClientProfile />} /> // <-- 2. Añadimos la ruta para el perfil de cliente
            )}
            
            {/* Si un usuario logueado va a una ruta no definida, se muestra este 404 */}
            <Route path="*" element={<NotFoundDashboard />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

// Componente para la página de bienvenida del dashboard
const WelcomeDashboard = () => (
  <div className="page-wrapper">
    <header className="page-header">
        <h1>Bienvenido a tu Panel de Control</h1>
        <p>Usa el menú de la izquierda para navegar por las diferentes secciones.</p>
    </header>
  </div>
);

// Componente para la página 404 dentro del dashboard
const NotFoundDashboard = () => (
    <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <header className="page-header">
            <h1>404 - Página no encontrada</h1>
            <p>La ruta a la que intentas acceder no existe dentro del panel.</p>
        </header>
    </div>
);


export default App;