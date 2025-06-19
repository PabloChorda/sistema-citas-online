// src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser, loginWithGoogle } from '../services/authService';
import '../styles/Login.css';
import GoogleLoginComponent from './GoogleLoginComponent';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = "618642945850-i4rekbfl4g49760m2jb11rocvnf29ji4.apps.googleusercontent.com";

function Login({ setToken, setRole }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser(email, password);
  
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('userRole', data.role);
  
      setToken(data.access_token);
      setRole(data.role);
      setMessage(`Login exitoso como ${data.role}.`);

      if (data.role === 'provider') {
        navigate('/provider/profile');
      } else {
        navigate('/profile');
      }

    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleGoogleLogin = async (provider, data) => {
    try {
      const result = await loginWithGoogle(data);

      localStorage.setItem('accessToken', result.access_token);
      localStorage.setItem('userRole', result.role);

      console.log("Token guardado en localStorage:", localStorage.getItem('accessToken'));
      console.log("Rol guardado:", localStorage.getItem('userRole'));

      setToken(result.access_token);
      setRole(result.role);

      window.location.reload();


      setMessage(`Login exitoso como ${result.role}`);

      if (result.role === 'provider') {
        navigate('/provider/profile');
      } else {
        navigate('/profile');
      }

    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Iniciar sesión</h1>
        <form onSubmit={handleSubmit}>
          <label>Email:
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>Contraseña:
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit">Iniciar sesión</button>
        </form>

        {message && <p className="login-message">{message}</p>}

        <div style={{ marginTop: '20px' }}>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleLoginComponent onLogin={handleGoogleLogin} />
          </GoogleOAuthProvider>
        </div>

        <p className="register-link">
          ¿No tienes una cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
        <p className="register-link">
          ¿Eres proveedor? <Link to="/register/provider">Regístrate como proveedor</Link>
        </p>
        <p className="register-link">
          Reestablecer Contraseña <Link to="/register/reset-password">¿Olvidaste tu contraseña?</Link>
        </p>
      </main>

      <footer className="login-footer">
        <p>¿Necesitas ayuda? <a href="mailto:soporte@citafacil.com">Contáctanos</a></p>
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default Login;