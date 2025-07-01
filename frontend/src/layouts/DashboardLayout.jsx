// frontend/src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Leemos el rol DENTRO del componente.
  // Así, cada vez que el layout se renderiza, obtiene el valor actualizado.
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
    backgroundColor: location.pathname === path ? '#374151' : 'transparent',
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-panel">
        <aside className="sidebar">
          <h2 className="sidebar-brand">CitaFácil</h2>
          <nav className="sidebar-nav">
            <ul>
              <li><Link to="/" style={getLinkStyle('/')}>Inicio</Link></li>

              {/* Ahora este menú condicional funcionará correctamente */}
              {userRole === 'provider' && (
                <li><Link to="/provider/profile" style={getLinkStyle('/provider/profile')}>Mi Perfil</Link></li>
              )}
              {userRole === 'client' && (
                <li><Link to="/client/profile" style={getLinkStyle('/client/profile')}>Mi Perfil</Link></li>
              )}
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