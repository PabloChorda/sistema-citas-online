// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import './App.css';

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
import EditEstablishment from './pages/EditEstablishment';
import ManageAvailability from './pages/ManageAvailability';
import BookingPage from './pages/BookingPage';
import ConfirmBookingPage from './pages/ConfirmBookingPage';
import BookingSuccessPage from './pages/BookingSuccessPage';
import ClientAppointments from './pages/ClientAppointments';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ProviderAppointments from './pages/ProviderAppointments';

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
        {/* --- 1. RUTAS PÚBLICAS --- */}
        <Route path="/" element={<BrowsePage />} />
        <Route path="/booking/:establishmentId" element={<BookingPage />} />
        <Route path="/booking/success" element={<BookingSuccessPage />} />
        <Route path="/login" element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/register/provider" element={!token ? <RegisterProvider /> : <Navigate to="/dashboard" />} />
        <Route path="/reset-password/:token" element={<NewPasswordForm />} />
        <Route path="/register/reset-password" element={<ResetPassword />} />

        {/* --- 2. RUTAS PROTEGIDAS --- */}
        <Route element={<ProtectedRoute token={token} />}>
          <Route path="/booking/confirm" element={<ConfirmBookingPage />} />
          <Route path="/dashboard" element={<DashboardLayout handleLogout={handleLogout} />}>
            <Route index element={<WelcomeDashboard />} />

            {/* --- GRUPO DE RUTAS PARA PROVEEDOR --- */}
            {role === 'provider' && (
              <Route path="provider">
                <Route path="profile" element={<ProviderProfile />} />
                <Route path="establishments" element={<ManageEstablishments />} />
                <Route path="establishments/new" element={<CreateEstablishment />} />
                <Route path="establishments/edit/:establishmentId" element={<EditEstablishment />} />
                <Route path="services" element={<ManageServices />} />
                <Route path="availability" element={<ManageAvailability />} />
                <Route path="appointments" element={<ProviderAppointments />} />
              </Route>
            )}

            {/* --- GRUPO DE RUTAS PARA CLIENTE --- */}
            {role === 'client' && (
              <Route path="client">
                <Route path="profile" element={<ClientProfile />} />
                <Route path="appointments" element={<ClientAppointments />} />
              </Route>
            )}
            
            <Route path="*" element={<NotFoundDashboard />} />
          </Route>
        </Route>
        
        {/* --- 3. RUTA COMODÍN FINAL --- */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

// ... (tus componentes auxiliares se mantienen igual)
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
            <h1>404 - No Encontrado</h1>
            <p>La página que buscas no existe dentro del panel de control.</p>
        </header>
    </div>
);

const NotFoundPage = () => (
    <div style={{ textAlign: 'center', paddingTop: '5rem', color: '#333' }}>
        <h1>404 - Página No Encontrada</h1>
        <p>Lo sentimos, la página que estás buscando no existe.</p>
        <Link to="/" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Volver a la página de inicio</Link>
    </div>
);

export default App;