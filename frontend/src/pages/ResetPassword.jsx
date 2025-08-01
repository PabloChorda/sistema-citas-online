import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/authService';


function ResetPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await requestPasswordReset(email);
      setMessage('📧 Si el correo existe, se ha enviado un enlace para restablecer tu contraseña.');
    } catch (error) {
      setMessage('❌ Ha ocurrido un error. Intenta de nuevo.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Restablecer contraseña</h1>
        <form onSubmit={handleSubmit}>
          <label>Email:
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button type="submit">Enviar enlace de recuperación</button>
        </form>
        {message && <p className="login-message">{message}</p>}

        <p className="register-link">
          ¿Recuerdas tu contraseña? <Link to="/login">Inicia sesión</Link>
        </p>
      </main>

      <footer className="login-footer">
        <p>¿Necesitas ayuda? <a href="mailto:soporte@citafacil.com">Contáctanos</a></p>
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default ResetPassword;
