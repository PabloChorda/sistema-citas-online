// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute';

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
import ProviderAppointments from './pages/ProviderAppointments';
import ProviderDashboard from './pages/ProviderDashboard';
import ManageStaff from './pages/ManageStaff';
import ManageStaffAvailability from './pages/ManageStaffAvailability';
import ClientDashboard from './pages/ClientDashboard';
import Magic from './pages/Magic';
import LoginPhone from './pages/LoginPhone';
import ProviderWhatsAppQR from './pages/ProviderWhatsAppQR';
import AdminMetricsPage from "./pages/AdminMetricsPage";

import { useAuth } from './context/AuthContext';

// Decide índice de dashboard por rol
function DashboardIndex() {
  const { me } = useAuth();
  if (me?.role === 'provider') return <ProviderDashboard />;
  return <ClientDashboard />;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />

      <Routes>
        {/* --- RUTAS PÚBLICAS --- */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/login-phone" element={<LoginPhone />} />
          <Route path="/magic" element={<Magic />} />
          <Route path="/booking/:establishmentId" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
        </Route>

        {/* --- AUTENTICACIÓN --- */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/register/provider"
          element={!isAuthenticated ? <RegisterProvider /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="/reset-password/:token" element={<NewPasswordForm />} />
        <Route path="/register/reset-password" element={<ResetPassword />} />

        {/* --- RUTAS PROTEGIDAS --- */}
        <Route element={<ProtectedRoute />}>
          <Route path="/booking/confirm" element={<ConfirmBookingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardIndex />} />

            {/* PROVEEDOR */}
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

            {/* CLIENTE */}
            <Route path="client">
              <Route path="profile" element={<ClientProfile />} />
              <Route path="appointments" element={<ClientAppointments />} />
            </Route>

            <Route path="*" element={<NotFoundDashboard />} />
          </Route>
        </Route>

        {/* COMODÍN */}
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
    <Link to="/" style={{ color: '#4f46e5', textDecoration: 'underline' }}>
      Volver a la página de inicio
    </Link>
  </div>
);
