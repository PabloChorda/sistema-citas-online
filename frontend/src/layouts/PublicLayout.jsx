// frontend/src/layouts/PublicLayout.jsx

import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import Button from '../components/ui/Button';
import Footer from './Footer';
import TokenBadge from '../components/auth/TokenBadge';
import EmailVerificationBanner from '../components/auth/EmailVerificationBanner';

const PublicLayout = ({ token, handleLogout }) => {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Marca + estado del token (solo dev) */}
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-2xl font-semibold text-brand-500 hover:text-brand-600 hover:underline"
              >
                CitaFácil
              </Link>
              <TokenBadge />
            </div>

            {/* Botones Condicionales */}
            <div className="flex items-center space-x-4">
              {token ? (
                <>
                  <Button variant="outline" to="/dashboard">
                    Mi Panel
                  </Button>
                  <Button variant="secondary" onClick={handleLogout}>
                    Cerrar Sesión
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" to="/login">
                    Iniciar Sesión
                  </Button>
                  <Button variant="primary" to="/register">
                    Registrarse
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* El main crece y empuja el footer abajo */}
      <main className="flex-grow">
      {token ? <EmailVerificationBanner /> : null}
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default PublicLayout;
