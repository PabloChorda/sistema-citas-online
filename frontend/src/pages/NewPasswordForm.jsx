// src/pages/NewPasswordForm.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resetPasswordWithToken } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

function SetNewPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Guardamos el timeout para poder limpiarlo si el componente se desmonta
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación mínima
    if (!password || password.length < 8) {
      setMessage('❌ La contraseña debe tener al menos 8 caracteres.');
      setSuccess(false);
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, password);
      setMessage('✅ Contraseña actualizada con éxito. Redirigiendo...');
      setSuccess(true);
      redirectTimeoutRef.current = setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      setMessage('❌ El enlace ha expirado o no es válido.');
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1 className="text-xl font-semibold text-gray-800">Establecer Nueva Contraseña</h1>
          <p className="text-sm text-gray-500">Introduce tu nueva contraseña segura</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <Input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={submitting}
          />
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Actualizando…' : 'Actualizar contraseña'}
          </Button>
        </form>

        {message && (
          <p className={`mt-4 text-sm ${success ? 'text-green-500' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        <footer className="login-footer mt-8 text-sm text-gray-500">
          <p>
            ¿Necesitas ayuda?{' '}
            <a
              href="mailto:soporte@citafacil.com"
              className="font-semibold text-brand-500 hover:text-brand-600 hover:underline"
            >
              Contáctanos
            </a>
          </p>
          <p className="mt-1">&copy; {year} CitaFácil. Todos los derechos reservados.</p>
        </footer>
      </main>
    </div>
  );
}

export default SetNewPassword;

