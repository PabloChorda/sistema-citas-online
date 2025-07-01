// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css'; // Asegúrate de que este archivo de estilos principal exista

// Layouts y Páginas
import DashboardLayout from './layouts/DashboardLayout.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';
import ProviderProfile from './pages/ProviderProfile'; // Importamos la nueva página

function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [role, setRole] = useState(localStorage.getItem('userRole'));

  useEffect(() => {
    // Esta función se ejecutará si el storage cambia en otra pestaña
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
          // --- RUTAS PÚBLICAS (sin token) ---
          <>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          // --- RUTAS PRIVADAS (con token) ---
          <Route path="/" element={<DashboardLayout handleLogout={handleLogout} />}>
            <Route index element={<WelcomeDashboard />} />
            
            {role === 'provider' && (
              <Route path="provider/profile" element={<ProviderProfile />} />
            )}
            
            {/* Aquí podrías añadir rutas para 'client' */}
            {/* {role === 'client' && <Route path="my-appointments" element={<MyAppointments />} />} */}
            
            <Route path="*" element={<h1>404 - Página no encontrada dentro del panel</h1>} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

// Componente de bienvenida para la página de inicio del dashboard
const WelcomeDashboard = () => (
  <div className="page-wrapper">
    <header className="page-header">
        <h1>Bienvenido a tu Panel de Control</h1>
        <p>Usa el menú de la izquierda para navegar por las diferentes secciones.</p>
    </header>
  </div>
);

export default App;