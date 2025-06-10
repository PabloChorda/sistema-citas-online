import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resetPasswordWithToken } from '../services/authService';
import '../styles/Login.css';

function SetNewPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPasswordWithToken(token, password);
      setMessage('✅ Contraseña actualizada con éxito. Redirigiendo...');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setMessage('❌ El enlace ha expirado o no es válido.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Establecer nueva contraseña</h1>
        <form onSubmit={handleSubmit}>
          <label>Nueva contraseña:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit">Actualizar contraseña</button>
        </form>
        {message && <p className={`login-message ${success ? 'success' : 'error'}`}>{message}</p>}
      </main>

      <footer className="login-footer">
        <p>¿Necesitas ayuda? <a href="mailto:soporte@citafacil.com">Contáctanos</a></p>
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default SetNewPassword;
