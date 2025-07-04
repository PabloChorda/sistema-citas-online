// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/Login.css';

// Layouts y Páginas
import BrowsePage from './pages/BrowsePage';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';
import ProviderProfile from './pages/ProviderProfile';
import ClientProfile from './pages/ClientProfile';
import ManageServices from './pages/ManageServices';
import ManageEstablishments from './pages/ManageEstablishments';
import CreateEstablishment from './pages/CreateEstablishment';
import ManageAvailability from './pages/ManageAvailability';
import BookingPage from './pages/BookingPage';
import ConfirmBookingPage from './pages/ConfirmBookingPage';
import BookingSuccessPage from './pages/BookingSuccessPage';


function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [role, setRole] = useState(localStorage.getItem('userRole'));

  useEffect(() => {
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
        {/* 
          --- RUTAS PÚBLICAS Y SEMIPÚBLICAS --- 
          Estas rutas no están dentro del DashboardLayout y son accesibles
          tanto para usuarios logueados como no logueados.
        */}
        <Route path="/" element={<BrowsePage />} /> {/* Nueva página de inicio */}
        <Route path="/booking/:establishmentId" element={<BookingPage />} />
        <Route path="/booking/success" element={<BookingSuccessPage />} />
        
        {/* --- RUTA DE CONFIRMACIÓN (PROTEGIDA) --- */}
        <Route 
          path="/booking/confirm" 
          element={
            // Si hay un token y el rol es 'client', muestra la página.
            // De lo contrario, redirige al login, guardando la intención original.
            (token && role === 'client') 
              ? <ConfirmBookingPage /> 
              : <Navigate to="/login" state={{ from: location }} replace />
          } 
        />

        {!token ? (
          // --- RUTAS EXCLUSIVAS PARA USUARIOS NO LOGUEADOS ---
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            
            {/* 
              Si un usuario no logueado intenta acceder a cualquier otra ruta que no sea
              las definidas arriba (como /provider/dashboard), lo mandamos a la home pública.
            */}
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          // --- RUTAS EXCLUSIVAS PARA USUARIOS LOGUEADOS (DASHBOARD) ---
          <Route path="/dashboard" element={<DashboardLayout handleLogout={handleLogout} />}>
            {/* 
              La ruta raíz del dashboard, ej: /dashboard/
              (Redirigimos desde / para que no haya conflicto con la BrowsePage)
            */}
            <Route index element={<WelcomeDashboard />} />
            
            {role === 'provider' && (
              <>
                <Route path="provider/profile" element={<ProviderProfile />} />
                <Route path="provider/establishments" element={<ManageEstablishments />} />
                <Route path="provider/establishments/new" element={<CreateEstablishment />} />
                <Route path="provider/services" element={<ManageServices />} />
                <Route path="provider/availability" element={<ManageAvailability />} />
              </>
            )}

            {role === 'client' && (
               <Route path="client/profile" element={<ClientProfile />} />
            )}

            <Route path="*" element={<NotFoundDashboard />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

const WelcomeDashboard = () => (
    <div className="page-wrapper">
        <header className="page-header">
            <h1>Bienvenido a tu Panel de Control</h1>
            <p>Usa el menú de la izquierda para navegar por las diferentes secciones.</p>
        </header>
    </div>
);

const NotFoundDashboard = () => (
    <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <header className="page-header">
            <h1>404 - Página no encontrada</h1>
            <p>La ruta a la que intentas acceder no existe dentro del panel.</p>
        </header>
    </div>
);

export default App;