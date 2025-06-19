// src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem('userRole'); // Obtener el rol del usuario

  const onLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  const getLinkStyle = (path) => {
    const baseStyle = {
      color: '#e2e8f0',
      textDecoration: 'none',
      fontSize: '15px',
      display: 'block',
      padding: '10px 15px',
      borderRadius: '6px',
      transition: 'background-color 0.2s ease-in-out',
    };
    if (location.pathname === path) {
      return { ...baseStyle, backgroundColor: '#2d3748' };
    }
    return baseStyle;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(to right, #667eea, #764ba2)'
    }}>
      
      <div style={{
        display: 'flex',
        height: '90vh',
        maxHeight: '800px',
        width: '90%',
        maxWidth: '1280px',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        
        <aside style={{ 
          width: '220px',
          flexShrink: 0,
          background: '#1a202c',
          color: 'white',
          padding: '20px 15px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          
          <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#cbd5e0', fontSize: '22px' }}>CitaFácil</h2>
          
          <nav style={{ flexGrow: 1 }}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '8px' }}>
                <Link to="/" style={getLinkStyle('/')}>Inicio</Link>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <Link 
                  to={role === 'provider' ? '/provider/profile' : '/profile'}
                  style={getLinkStyle(role === 'provider' ? '/provider/profile' : '/profile')}
                >
                  Mi Perfil
                </Link>
              </li>
            </ul>
          </nav>

          <div style={{ marginTop: '20px' }}>
              <button 
                onClick={onLogoutClick} 
                style={{
                  width: '100%', 
                  padding: '10px',
                  background: '#2d3748',
                  color: '#e2e8f0',
                  border: 'none', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
              >
                Cerrar Sesión
              </button>
          </div>
        </aside>

        <main style={{ 
          flexGrow: 1,
          padding: '30px',
          overflowY: 'auto',
          background: '#f7fafc',
          boxSizing: 'border-box'
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}