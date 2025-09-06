// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout.jsx';

import BrowsePage from './pages/BrowsePage';
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
import ProviderWhatsAppQR from './pages/ProviderWhatsAppQR';
import AdminMetricsPage from "./pages/AdminMetricsPage";
import useProactiveRefresh from './hooks/useProactiveRefresh';
import useAuthMe from './hooks/useAuthMe';

function App() {
  const [token, setToken] = useState(
    localStorage.getItem('accessToken') || localStorage.getItem('access_token')
  );

  // 👉 Nuevo: cargamos me desde /auth/me
  const { me, loading: meLoading, refreshMe } = useAuthMe();

  // --- SHIM: sincroniza accessToken <-> access_token al montar ---
  useEffect(() => {
    try {
      const t1 = localStorage.getItem('accessToken');
      const t2 = localStorage.getItem('access_token');
      const chosen = t1 || t2;
      if (chosen) {
        if (t1 !== chosen) localStorage.setItem('accessToken', chosen);
        if (t2 !== chosen) localStorage.setItem('access_token', chosen);
        setToken(chosen);
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.debug('App init: storage not available', e);
    }
  }, []);

  // escucha cambios de storage para mantener estado en sync
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('accessToken') || localStorage.getItem('access_token'));
      // useAuthMe ya reacciona y recarga /auth/me
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogin = (newToken, _newRole) => {
    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
    // dispara storage -> useAuthMe recarga /auth/me
    window.dispatchEvent(new Event('storage'));
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('userRole'); // legacy
    setToken(null);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <Routes>
        {/* --- GRUPO 1: RUTAS PÚBLICAS --- */}
        <Route element={<PublicLayout me={me} token={token} handleLogout={handleLogout} />}>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/login-phone" element={<LoginPhone />} />
          <Route path="/magic" element={<Magic />} />
          <Route path="/booking/:establishmentId" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
        </Route>

        {/* --- GRUPO 2: RUTAS DE AUTENTICACIÓN --- */}
        <Route path="/login" element={!token ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/register/provider" element={!token ? <RegisterProvider /> : <Navigate to="/dashboard" />} />
        <Route path="/reset-password/:token" element={<NewPasswordForm />} />
        <Route path="/register/reset-password" element={<ResetPassword />} />

        {/* --- GRUPO 3: RUTAS PROTEGIDAS --- */}
        <Route element={<ProtectedRoute token={token} />}>
          <Route path="/booking/confirm" element={<ConfirmBookingPage />} />
          <Route path="/dashboard" element={<DashboardLayout handleLogout={handleLogout} me={me} />}>
            {/* índice condicional según me.role */}
            <Route
              index
              element={
                meLoading ? (
                  <div className="p-6 text-sm text-slate-500">Cargando…</div>
                ) : me?.role === 'provider' ? (
                  <ProviderDashboard />
                ) : (
                  <ClientDashboard />
                )
              }
            />

            {/* PROVEEDOR */}
            {me?.role === 'provider' && (
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
                <Route path="whatsapp-qr" element={<ProviderWhatsAppQR />} />
                <Route path="admin/metrics" element={<AdminMetricsPage />} />
              </Route>
            )}

            {/* CLIENTE */}
            {me?.role === 'client' && (
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
