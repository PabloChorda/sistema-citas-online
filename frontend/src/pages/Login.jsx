// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService'; // Asumo que tienes loginWithGoogle en authService
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
        navigate('/'); // Redirige a la página principal del dashboard
    } catch (error) {
        setMessage(error.message || "Error al iniciar sesión");
    }
  };

  // Aquí puedes añadir la lógica para Google si la tienes
  // const handleGoogleSuccess = async (response) => { ... };

  return (
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1>Iniciar Sesión</h1>
          <p>Accede a tu cuenta para gestionar tus citas</p>
        </header>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">Entrar</button>
        </form>
        {message && <p className="login-message">{message}</p>}
        {/* Aquí iría el botón de login con Google */}
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