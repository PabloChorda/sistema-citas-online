// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import { Toaster } from 'react-hot-toast';


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
import ProviderDashboard from './pages/ProviderDashboard';
import ManageStaff from './pages/ManageStaff';
import ManageStaffAvailability from './pages/ManageStaffAvailability';
import ClientDashboard from './pages/ClientDashboard';
import Magic from './pages/Magic';
import LoginPhone from './pages/LoginPhone';




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
      <Toaster 
        position="top-right"
        toastOptions={{ duration: 5000 }}
      />
      <Routes>
        {/* --- GRUPO 1: RUTAS PÚBLICAS --- */}
        <Route element={<PublicLayout token={token} role={role} handleLogout={handleLogout} />}>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/magic" element={<Magic />} /> 
          <Route path="/booking/:establishmentId" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
        </Route>

        {/* --- GRUPO 2: RUTAS DE AUTENTICACIÓN --- */}
        <Route path="/login" element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />
        <Route path="/login-phone" element={!token ? <LoginPhone /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/register/provider" element={!token ? <RegisterProvider /> : <Navigate to="/dashboard" />} />
        <Route path="/reset-password/:token" element={<NewPasswordForm />} />
        <Route path="/register/reset-password" element={<ResetPassword />} />

        {/* --- GRUPO 3: RUTAS PROTEGIDAS --- */}
        <Route element={<ProtectedRoute token={token} />}>
          <Route path="/booking/confirm" element={<ConfirmBookingPage />} />
          <Route path="/dashboard" element={<DashboardLayout handleLogout={handleLogout} />}>
            
            {/* --- 2. RUTA ÍNDICE AHORA ES CONDICIONAL --- */}
            <Route 
              index 
              element={
                role === 'provider' 
                  ? <ProviderDashboard />    // <-- Si es proveedor, muestra su dashboard
                  : <ClientDashboard />      // <-- Si es cliente, muestra el nuevo
              } 
            />
            
            {/* GRUPO DE RUTAS PARA PROVEEDOR */}
            {role === 'provider' && (
              <Route path="provider">
                <Route path="profile" element={<ProviderProfile />} />
                <Route path="establishments" element={<ManageEstablishments />} />
                <Route path="establishments/new" element={<CreateEstablishment />} />
                <Route path="establishments/edit/:establishmentId" element={<EditEstablishment />} />
                <Route path="services" element={<ManageServices />} />
                <Route path="availability" element={<ManageAvailability />} />
                <Route path="appointments" element={<ProviderAppointments />} />
                <Route path="staff" element={<ManageStaff />} />
                <Route path="staff/availability" element={<ManageStaffAvailability />} />
              </Route>
            )}

            {/* GRUPO DE RUTAS PARA CLIENTE */}
            {role === 'client' && (
              <Route path="client">
                <Route path="profile" element={<ClientProfile />} />
                <Route path="appointments" element={<ClientAppointments />} />
              </Route>
            )}
            
            <Route path="*" element={<NotFoundDashboard />} />
          </Route>
        </Route>
        
        {/* RUTA COMODÍN FINAL */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

// --- 3. ELIMINAMOS WelcomeDashboard PORQUE YA NO SE USA DIRECTAMENTE AQUÍ ---
// Lo hemos reemplazado por ClientDashboard para los clientes.
// Si un rol 'admin' necesitara una bienvenida genérica en el futuro,
// podríamos mover este componente a su propio archivo.

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