// frontend/src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
// Opcional: Si quieres usar iconos, como en mi ejemplo anterior.
// import { WrenchScrewdriverIcon, UserIcon, HomeIcon } from '@heroicons/react/24/outline';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');

  const onLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  const getLinkStyle = (path) => ({
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: '15px',
    display: 'block',
    padding: '10px 15px',
    borderRadius: '8px',
    transition: 'background-color 0.2s ease-in-out',
    backgroundColor: location.pathname.startsWith(path) && path !== '/' ? '#374151' : location.pathname === path ? '#374151' : 'transparent',
  });

  // --- Mejoramos la lógica de renderizado de enlaces ---
  const renderNavLinks = () => {
    if (userRole === 'provider') {
      return (
        <>
          <li>
            <Link to="/provider/profile" style={getLinkStyle('/provider/profile')}>
              Mi Perfil
            </Link>
          </li>
          {/* --- ENLACE NUEVO AÑADIDO AQUÍ --- */}
          <li>
            <Link to="/provider/services" style={getLinkStyle('/provider/services')}>
              Servicios
            </Link>
          </li>
        </>
      );
    }
    
    if (userRole === 'client') {
      return (
        <li>
          <Link to="/client/profile" style={getLinkStyle('/client/profile')}>
            Mi Perfil
          </Link>
        </li>
      );
    }

    // Retorna null o un menú por defecto si no hay un rol específico
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
                <Link to="/" style={getLinkStyle('/')}>
                  Inicio
                </Link>
              </li>
              {/* Llamamos a la función que renderiza los enlaces según el rol */}
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