// src/layouts/DashboardLayout.jsx

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function DashboardLayout({ handleLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

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
    // 1. Contenedor exterior: Ocupa toda la pantalla y centra el panel principal.
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(to right, #667eea, #764ba2)' // Fondo degradado como en el login
    }}>
      
      {/* 2. Panel principal: tiene un tamaño máximo y un borde redondeado. */}
      <div style={{
        display: 'flex',
        height: '90vh',         // Ocupa el 90% del alto de la ventana
        maxHeight: '800px',     // Pero nunca más de 800px
        width: '90%',           // Ocupa el 90% del ancho
        maxWidth: '1280px',     // Pero nunca más de 1280px
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        borderRadius: '10px',
        overflow: 'hidden' // Esconde cualquier cosa que se desborde
      }}>
        
        {/* --- Barra Lateral de Navegación --- */}
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
                <Link to="/provider/profile" style={getLinkStyle('/provider/profile')}>Mi Perfil</Link>
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

        {/* --- Área de Contenido Principal --- */}
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
