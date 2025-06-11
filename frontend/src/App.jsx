// src/App.jsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// --- Layouts y Páginas ---
// Importamos el nuevo layout que contendrá las páginas privadas
import DashboardLayout from './layouts/DashboardLayout.jsx'; 

// Importamos todas las páginas que usaremos en las rutas
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterProvider from './pages/RegisterProvider';
import ResetPassword from './pages/ResetPassword';
import NewPasswordForm from './pages/NewPasswordForm';
import ProviderProfile from './pages/ProviderProfile';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  // --- REHIDRATACIÓN DEL ESTADO ---
  // Este useEffect se ejecuta UNA SOLA VEZ cuando la aplicación carga por primera vez.
  // Su misión es "recordar" la sesión del usuario si ya había iniciado sesión.
  useEffect(() => {
    // Busca el token y el rol en el almacenamiento persistente
    const storedToken = localStorage.getItem('accessToken');
    const storedRole = localStorage.getItem('userRole');

    // Si existen, actualiza el estado de React con ellos.
    if (storedToken && storedRole) {
      setToken(storedToken);
      setRole(storedRole);
    }
    // El array vacío [] asegura que solo se ejecute al montar el componente.
  }, []);

  // --- MANEJO DE SESIÓN ---
  const handleLogout = () => {
    // Limpia el estado de React y el almacenamiento local para cerrar sesión
    setToken(null);
    setRole(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userRole');
  };

  return (
    <Router>
      <Routes>
        {!token ? (
          // --- RUTAS PÚBLICAS (si no hay token) ---
          // Estas rutas son accesibles para cualquier persona.
          <>
            <Route path="/login" element={<Login setToken={setToken} setRole={setRole} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/provider" element={<RegisterProvider />} />
            <Route path="/reset-password/:token" element={<NewPasswordForm />} />
            <Route path="/register/reset-password" element={<ResetPassword />} />
            {/* Si un usuario no logueado intenta ir a cualquier otra ruta, se le redirige al login */}
            <Route path="*" element={<Navigate to="/login" />} />
          </>
        ) : (
          // --- RUTAS PRIVADAS (si SÍ hay token) ---
          // Estas rutas están envueltas por el DashboardLayout, que mostrará el menú lateral.
          <Route path="/" element={<DashboardLayout handleLogout={handleLogout} />}>
            
            {/* Ruta Índice: lo que se ve en la página principal ('/') después de iniciar sesión */}
            <Route index element={
               <div style={{ color: '#1a202c' }}> {/* Color oscuro del menú lateral */}
               <h1 style={{ fontWeight: '300', fontSize: '2.5rem' }}>Bienvenido a tu Panel de Control</h1>
               <p style={{ marginTop: '10px', fontSize: '1.1rem' }}>
                 Usa el menú de la izquierda para navegar por las diferentes secciones.
               </p>
             </div>
            } />
            
            {/* Rutas específicas según el rol del usuario */}
            {role === 'provider' && (
              <Route path="provider/profile" element={<ProviderProfile />} />
            )}
            
            {/* Aquí podrías añadir más rutas para clientes, por ejemplo: */}
            {/* {role === 'client' && <Route path="client/dashboard" element={<ClientDashboard />} />} */}
            
            {/* Ruta "Catch-all": se muestra si el usuario va a una ruta que no existe DENTRO del panel */}
            <Route path="*" element={<h1>404 - Página no encontrada dentro del panel</h1>} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;
