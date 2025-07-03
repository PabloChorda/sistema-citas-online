// frontend/src/pages/Login.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// 1. Importamos todo lo necesario
import { loginUser, loginWithGoogle } from '../services/authService';
import GoogleLoginComponent from "./GoogleLoginComponent";
import '../styles/Login.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
        const data = await loginUser(email, password);
        onLogin(data.access_token, data.role);
        navigate('/');
    } catch (error) {
        setMessage(error.message || "Error al iniciar sesión");
    }
  };

  // 2. Creamos la función para manejar el login de Google
  const handleGoogleLogin = async (googleToken) => {
    setMessage('');
    try {
      // Llamamos a nuestro authService con el token de Google
      const data = await loginWithGoogle(googleToken);
      // El resto del flujo es el mismo que el login normal
      onLogin(data.access_token, data.role);
      navigate('/');
    } catch (error) {
      setMessage(error.message || "Error en el inicio de sesión con Google");
    }
  };

  return (
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1>Iniciar Sesión</h1>
          <p>Accede a tu cuenta para gestionar tus citas</p>
        </header>
        
        {/* Separador y Botón de Google */}
        <div style={{ alignSelf: 'center', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <GoogleLoginComponent onLogin={handleGoogleLogin} />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', color: '#9ca3af', margin: '0 0 1.5rem 0' }}>
          <hr style={{ flexGrow: 1, borderTop: '1px solid #e5e7eb' }} />
          <span style={{ padding: '0 1rem', fontSize: '0.9rem' }}>O</span>
          <hr style={{ flexGrow: 1, borderTop: '1px solid #e5e7eb' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Entrar</button>
        </form>

        {message && <p className="login-message" style={{ color: 'red' }}>{message}</p>}
        
        <footer className="login-footer">
          <p>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
          <p>¿Eres proveedor? <Link to="/register/provider">Regístrate como proveedor</Link></p>
          <p><Link to="/register/reset-password">¿Olvidaste tu contraseña?</Link></p>
        </footer>
      </main>
    </div>
  );
}

export default Login;