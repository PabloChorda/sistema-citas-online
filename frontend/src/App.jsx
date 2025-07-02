// frontend/src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/Login.css';

// Layouts y Páginas
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
// --- 1. IMPORTAMOS LA NUEVA PÁGINA DE EDICIÓN ---
import EditEstablishment from './pages/EditEstablishment';


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
        {!token ? (
          // --- RUTAS PÚBLICAS ---
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          // --- RUTAS PRIVADAS ---
          <Route path="/" element={<DashboardLayout handleLogout={handleLogout} />}>
            
            <Route index element={<WelcomeDashboard />} />

            {/* RUTAS DEL PROVEEDOR */}
            {role === 'provider' && (
              <>
                <Route path="provider/profile" element={<ProviderProfile />} />
                <Route path="provider/services" element={<ManageServices />} />
                
                <Route path="provider/establishments" element={<ManageEstablishments />} />
                <Route path="provider/establishments/new" element={<CreateEstablishment />} />
                
                {/* --- 2. AÑADIMOS LA RUTA DE EDICIÓN --- */}
                {/* El ':id' es un parámetro dinámico que se pasará al componente */}
                <Route path="provider/establishments/edit/:id" element={<EditEstablishment />} />
              </>
            )}

            {/* RUTAS DEL CLIENTE */}
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