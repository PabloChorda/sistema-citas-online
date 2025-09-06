// frontend/src/layouts/DashboardLayout.jsx
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import TokenBadge from '../components/auth/TokenBadge';
import EmailVerificationBanner from '../components/auth/EmailVerificationBanner';

export default function DashboardLayout({ handleLogout, me }) {
  const navigate = useNavigate();
  const location = useLocation();

  // 🔁 Ahora el rol viene de `me`, no de localStorage
  const userRole = me?.role || null;

  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Detecta tamaño de pantalla (<=768px = móvil)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Cierra el drawer en navegación
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Bloquea/desbloquea scroll del body SOLO cuando el drawer está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const onLogoutClick = useCallback(() => {
    handleLogout();
    navigate('/login');
    setDrawerOpen(false);
  }, [handleLogout, navigate]);

  const getLinkStyle = (path) => {
    const isActivePath = (target) => {
      if (target === '/') return location.pathname === '/';
      if (target === '/dashboard') return location.pathname === '/dashboard';
      return location.pathname === target || location.pathname.startsWith(`${target}/`);
    };
    const isActive = isActivePath(path);

    return {
      color: isActive ? '#ffffff' : '#e2e8f0',
      textDecoration: 'none',
      fontSize: '15px',
      display: 'block',
      padding: '10px 15px',
      borderRadius: '8px',
      transition: 'background-color 0.2s ease-in-out',
      backgroundColor: isActive ? '#374151' : 'transparent',
    };
  };

  const renderNavLinks = () => {
    const linkBaseStyle = {
      display: 'block',
      width: '100%',
      padding: '10px 15px',
      borderRadius: '8px',
      fontSize: '15px',
      textDecoration: 'none',
      transition: 'background-color 0.2s ease-in-out',
    };

    if (userRole === 'provider') {
      return (
        <>
          <li>
            <Link
              to="/dashboard/provider/profile"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/provider/profile') }}
            >
              Mi Perfil
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/provider/establishments"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/provider/establishments') }}
            >
              Establecimientos
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/provider/services"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/provider/services') }}
            >
              Servicios
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/provider/admin/metrics"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/provider/admin/metrics') }}
            >
              Métricas
            </Link>
          </li>
        </>
      );
    }

    if (userRole === 'client') {
      return (
        <>
          <li>
            <Link
              to="/dashboard/client/profile"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/client/profile') }}
            >
              Mi Perfil
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/client/appointments"
              style={{ ...linkBaseStyle, ...getLinkStyle('/dashboard/client/appointments') }}
            >
              Mis Citas
            </Link>
          </li>
          <li>
            <Link to="/" style={{ ...linkBaseStyle, ...getLinkStyle('/') }}>
              Reservar Cita
            </Link>
          </li>
        </>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        backgroundColor: '#f9fafb',
      }}
    >
      {/* Botón hamburguesa SOLO en móvil */}
      {isMobile && (
        <button
          aria-label="Abrir menú"
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            zIndex: 10001,
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            padding: 8,
            border: '1px solid #374151',
          }}
        >
          <Bars3Icon width={22} height={22} />
        </button>
      )}

      {/* Sidebar desktop (fijo/sticky) */}
      <aside
        className="sidebar"
        style={{
          display: isMobile ? 'none' : 'flex',
          flexDirection: 'column',
          width: 260,
          background: '#111827',
          color: '#e5e7eb',
          padding: '16px 12px',
          position: 'sticky',
          top: 0,
          height: '100dvh',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div>
          <h2 className="sidebar-brand" style={{ margin: 0 }}>
            CitaFácil
          </h2>
          {/* TokenBadge (solo dev) */}
          <div style={{ marginTop: 8 }}>
            <TokenBadge />
          </div>
        </div>

        <nav
          className="sidebar-nav"
          style={{
            marginTop: 12,
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            paddingRight: 4,
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li>
              <Link to="/dashboard" style={getLinkStyle('/dashboard')}>
                Inicio
              </Link>
            </li>
            {renderNavLinks()}
          </ul>
        </nav>

        {/* Footer sticky: siempre visible al fondo */}
        <div
          className="sidebar-footer"
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#111827',
            paddingTop: 10,
          }}
        >
          <button onClick={onLogoutClick} style={{ width: '100%', padding: '10px 12px' }}>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Drawer móvil + overlay */}
      {isMobile && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: drawerOpen ? 'rgba(0,0,0,0.45)' : 'transparent',
              transition: 'background 200ms ease',
              pointerEvents: drawerOpen ? 'auto' : 'none',
              zIndex: 10000,
            }}
          />
          {/* Cajón lateral */}
          <aside
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100dvh',
              width: 260,
              background: '#111827',
              color: '#e5e7eb',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 220ms ease',
              zIndex: 10002,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 12px',
              boxShadow: '2px 0 16px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <h2 className="sidebar-brand" style={{ margin: 0 }}>
                CitaFácil
              </h2>
              <button
                aria-label="Cerrar menú"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#e5e7eb',
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                <XMarkIcon width={22} height={22} />
              </button>
            </div>

            {/* TokenBadge también en móvil */}
            <div style={{ marginBottom: 8 }}>
              <TokenBadge />
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                }}
                onClick={() => setDrawerOpen(false)}
              >
                <li>
                  <Link
                    to="/dashboard"
                    style={{ ...getLinkStyle('/dashboard'), display: 'block', width: '100%' }}
                  >
                    Inicio
                  </Link>
                </li>
                {renderNavLinks()}
              </ul>
            </nav>

            <div className="sidebar-footer" style={{ paddingTop: 12 }}>
              <button onClick={onLogoutClick} style={{ width: '100%' }}>
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Contenido principal */}
      <main
        className="main-content"
        style={{
          flex: 1,
          minHeight: '100dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: 16,
          overflowX: 'clip',
        }}
      >
        <EmailVerificationBanner />
        <Outlet />
      </main>
    </div>
  );
}
