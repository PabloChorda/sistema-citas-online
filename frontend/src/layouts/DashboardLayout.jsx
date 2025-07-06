// frontend/src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
// Opcional: Puedes importar iconos para darle más vida al menú
// import { CalendarDaysIcon, BuildingStorefrontIcon, WrenchScrewdriverIcon, UserIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');

  const onLogoutClick = () => {
    handleLogout();
    navigate('/login'); // Redirige al login, no a la home pública
  };

  const getLinkStyle = (path) => ({
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: '15px',
    display: 'block',
    padding: '10px 15px',
    borderRadius: '8px',
    transition: 'background-color 0.2s ease-in-out',
    backgroundColor: location.pathname.startsWith(path) && path !== '/dashboard' ? '#374151' : location.pathname === path ? '#374151' : 'transparent',
  });

  const renderNavLinks = () => {
    // --- MENÚ PARA PROVEEDORES ---
    if (userRole === 'provider') {
      return (
        <>
          <li>
            <Link to="/dashboard/provider/profile" style={getLinkStyle('/dashboard/provider/profile')}>
              Mi Perfil
            </Link>
          </li>
          <li>
            <Link to="/dashboard/provider/establishments" style={getLinkStyle('/dashboard/provider/establishments')}>
              Establecimientos
            </Link>
          </li>
          <li>
            <Link to="/dashboard/provider/services" style={getLinkStyle('/dashboard/provider/services')}>
              Servicios
            </Link>
          </li>
        </>
      );
    }
    
    // --- MENÚ PARA CLIENTES (ACTUALIZADO) ---
    if (userRole === 'client') {
      return (
        <>
          <li>
            <Link to="/dashboard/client/profile" style={getLinkStyle('/dashboard/client/profile')}>
              Mi Perfil
            </Link>
          </li>
          {/* --- ENLACE AÑADIDO PARA "MIS CITAS" --- */}
          <li>
            <Link to="/dashboard/client/appointments" style={getLinkStyle('/dashboard/client/appointments')}>
              Mis Citas
            </Link>
          </li>
        </>
      );
    }

    return null;
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-panel">
        <aside className="sidebar">
          <h2 className="sidebar-brand">CitaFácil</h2>
          <nav className="sidebar-nav">
            <ul>
              <li>
                {/* El enlace de "Inicio" ahora apunta al dashboard */}
                <Link to="/dashboard" style={getLinkStyle('/dashboard')}>
                  Inicio
                </Link>
              </li>
              {renderNavLinks()}
            </ul>
          </nav>
          <div className="sidebar-footer">
            <button onClick={onLogoutClick}>Cerrar Sesión</button>
          </div>
        </aside>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}