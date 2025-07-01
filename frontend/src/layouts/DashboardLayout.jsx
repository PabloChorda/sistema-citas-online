// frontend/src/layouts/DashboardLayout.jsx
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const onLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  // Función para determinar el estilo del enlace activo
  const getLinkStyle = (path) => ({
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: '15px',
    display: 'block',
    padding: '10px 15px',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease-in-out',
    backgroundColor: location.pathname === path ? '#2d3748' : 'transparent',
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-panel">
        <aside className="sidebar">
          <h2 className="sidebar-brand">CitaFácil</h2>
          <nav className="sidebar-nav">
            <ul>
              <li><Link to="/" style={getLinkStyle('/')}>Inicio</Link></li>
              <li><Link to="/provider/profile" style={getLinkStyle('/provider/profile')}>Mi Perfil</Link></li>
              {/* Aquí irían más enlaces para proveedores */}
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