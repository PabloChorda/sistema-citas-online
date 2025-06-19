// src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// --- Layouts y Páginas ---
import DashboardLayout from './layouts/DashboardLayout.jsx'; 
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';
import ProviderProfile from './pages/ProviderProfile';
import Profile from './pages/Profile';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  // Rehidratar sesión desde localStorage al montar la app
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedRole = localStorage.getItem('userRole');

    if (storedToken && storedRole) {
      setToken(storedToken);
      setRole(storedRole);
    }
  }, []);

  const handleLogout = () => {
    setToken(null);
    setRole(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
  };

  return (
    <Router>
      <Routes>
        {!token ? (
          // --- RUTAS PÚBLICAS ---
          <>
            <Route path="/login" element={<Login setToken={setToken} setRole={setRole} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          // --- RUTAS PRIVADAS ---
          <Route path="/" element={<DashboardLayout handleLogout={handleLogout} />}>
            <Route
              index
              element={
                <div style={{ color: '#1a202c', padding: '2rem' }}>
                  <h1 style={{ fontWeight: 300, fontSize: '2.5rem' }}>
                    Bienvenido a tu Panel de Control
                  </h1>
                  <p style={{ marginTop: '10px', fontSize: '1.1rem' }}>
                    Usa el menú de la izquierda para navegar por las diferentes secciones.
                  </p>
                </div>
              }
            />

            {role === 'provider' && (
              <Route path="provider/profile" element={<ProviderProfile />} />
            )}

            {role === 'client' && (
              <Route path="profile" element={<Profile />} />
            )}

            <Route path="*" element={<h1>404 - Página no encontrada dentro del panel</h1>} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;