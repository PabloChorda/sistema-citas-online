// frontend/src/pages/ResetPassword.jsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { requestPasswordReset } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

function ResetPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      // Por seguridad, siempre mostramos un mensaje de éxito,
      // incluso si el email no existe. Esto evita que alguien pueda
      // adivinar qué correos están registrados en el sistema.
      toast.success('Si el correo existe, se ha enviado un enlace para restablecer tu contraseña.');
    } catch (error) {
      // Aunque mostramos éxito al usuario, podemos loguear el error real
      console.error("Error en requestPasswordReset:", error);
      toast.error('Ha ocurrido un error. Por favor, intenta de nuevo más tarde.');
    } finally {
      setIsSubmitting(false);
      // Limpiamos el campo de email después del intento
      setEmail('');
    }
  };

  return (
    // Reutilizamos el layout del login para mantener la consistencia
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1>Restablecer Contraseña</h1>
          <p>Introduce tu email para recibir el enlace de recuperación</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8">
          <Input
            type="email"
            placeholder="Introduce tu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar Enlace'}
          </Button>
        </form>

        <footer className="login-footer">
          <p>¿Recuerdas tu contraseña? <Link to="/login">Inicia sesión</Link></p>
        </footer>
      </main>
    </div>
  );
}

export default ResetPassword;