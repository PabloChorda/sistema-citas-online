// src/pages/NewPasswordForm.jsx

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { resetPasswordWithToken } from '../services/authService';
import '../styles/Login.css';

function NewPasswordForm() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPasswordWithToken(token, password);
      setSuccess(true);
      setMessage('✅ Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
    } catch (error) {
      setSuccess(false);
      setMessage('❌ Error al actualizar la contraseña. El enlace puede estar expirado.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>🔐 Restablecer Contraseña</h2>
      </header>

      <main className="login-container">
        <h1>Ingresa una nueva contraseña</h1>
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
        {message && (
          <p className={`login-message ${success ? 'success' : 'error'}`}>{message}</p>
        )}

        {success && (
          <p className="register-link">
            <Link to="/login">Ir a inicio de sesión</Link>
          </p>
        )}
      </main>

      <footer className="login-footer">
        <p>¿Necesitas ayuda? <a href="mailto:soporte@citafacil.com">Contáctanos</a></p>
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default NewPasswordForm;
