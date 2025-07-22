// frontend/src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');

  const onLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  const getLinkStyle = (path) => {
    // Lógica mejorada para el resaltado del enlace activo
    const isActive = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
    return {
      color: '#e2e8f0',
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
          {/* Aquí podrías añadir un futuro enlace a la Agenda del Proveedor */}
        </>
      );
    }
    
    // --- MENÚ PARA CLIENTES ---
    if (userRole === 'client') {
      return (
        <>
          <li>
            <Link to="/dashboard/client/profile" style={getLinkStyle('/dashboard/client/profile')}>
              Mi Perfil
            </Link>
          </li>
          <li>
            <Link to="/dashboard/client/appointments" style={getLinkStyle('/dashboard/client/appointments')}>
              Mis Citas
            </Link>
          </li>
          {/* Enlace para que un cliente pueda iniciar una nueva reserva */}
          <li>
             <Link to="/" style={getLinkStyle('/')}>
              Reservar Cita
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