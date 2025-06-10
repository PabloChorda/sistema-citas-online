// src/pages/Login.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginUser } from '../services/authService';
import '../styles/Login.css';

function Login({ setToken, setRole }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser(email, password);
      setToken(data.access_token);
      setRole(data.role);
      setMessage(`Login exitoso como ${data.role}`);
    } catch (error) {
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

        <p className="register-link">
          ¿No tienes una cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
        <p className="register-link">
            ¿Eres proveedor? <Link to="/register/provider">Regístrate como proveedor</Link>
        </p>
        <p className="register-link">
            Reestablecer Contraseña <Link to="/register/reset-password">Regístrate como proveedor</Link>
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
