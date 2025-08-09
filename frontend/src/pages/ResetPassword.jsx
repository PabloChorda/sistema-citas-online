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
      toast.success('Si el correo existe, se ha enviado un enlace para restablecer tu contraseña.');
    } catch (error) {
      console.error("Error en requestPasswordReset:", error);
      toast.error('Ha ocurrido un error. Por favor, intenta de nuevo más tarde.');
    } finally {
      setIsSubmitting(false);
      setEmail('');
    }
  };

  return (
    <div className="auth-page">
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1 className="text-xl font-semibold text-white">Restablecer Contraseña</h1>
          <p className="text-sm text-white mt-1">Introduce tu email y te enviaremos un enlace para recuperar el acceso</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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

        <footer className="login-footer mt-6 text-center text-sm text-gray-500">
          <p>¿Recuerdas tu contraseña? <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-600 hover:underline">Inicia sesión</Link></p>
        </footer>
      </main>
    </div>
    </div>
  );
}

export default ResetPassword;
