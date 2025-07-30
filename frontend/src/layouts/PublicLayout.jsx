// frontend/src/layouts/PublicLayout.jsx

import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

// Pasamos token, role, y handleLogout desde App.jsx
const PublicLayout = ({ token, role, handleLogout }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo o Nombre de la App */}
            <Link to="/" className="text-2xl font-bold text-indigo-600">
              CitaFácil
            </Link>
            
            {/* Botones Condicionales */}
            <div className="flex items-center space-x-4">
              {token ? (
                // Si el usuario está logueado
                <>
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Mi Panel
                  </Button>
                  <Button variant="secondary" onClick={handleLogout}>
                    Cerrar Sesión
                  </Button>
                </>
              ) : (
                // Si el usuario NO está logueado
                <>
                  <Button variant="outline" onClick={() => navigate('/login')}>
                    Iniciar Sesión
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/register')}>
                    Registrarse
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>
      
      {/* Aquí se renderizará el contenido de la página (BrowsePage, BookingPage, etc.) */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;