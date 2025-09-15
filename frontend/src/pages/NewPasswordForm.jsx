// src/pages/NewPasswordForm.jsx
import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPasswordWithToken } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function NewPasswordForm() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const disabled = useMemo(() => {
    if (!password || !confirm) return true;
    if (password.length < 8) return true;
    if (password !== confirm) return true;
    return submitting;
  }, [password, confirm, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!token) {
      setErrorMsg('El enlace no es válido. Solicita un nuevo email de restablecimiento.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, password);
      setSuccessMsg('✅ Contraseña actualizada con éxito. Redirigiendo…');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch {
      setErrorMsg('❌ El enlace ha expirado o no es válido. Solicita uno nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tarjeta blanca única (sin auth-page/login-container/login-box)
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow p-8 text-left">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Establecer Nueva Contraseña</h1>
          <p className="text-sm text-gray-600 mt-1">Introduce y confirma tu nueva contraseña</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nueva contraseña */}
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-2 my-auto inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>

          {/* Confirmación */}
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirmar nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-2 my-auto inline-flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              {showConfirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>

          {/* Reglas rápidas */}
          <ul className="text-xs text-gray-500 space-y-1">
            <li className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              Mínimo 8 caracteres
            </li>
            <li className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              Recomendado: combinar letras y números
            </li>
          </ul>

          {/* Estados */}
          {errorMsg && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {errorMsg}
            </p>
          )}
          {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

          <div className="pt-2 flex justify-center">
            <Button type="submit" variant="primary" disabled={disabled}>
              {submitting ? 'Actualizando…' : 'Actualizar contraseña'}
            </Button>
          </div>
        </form>

        <footer className="mt-8 text-sm text-gray-500">
          <p>
            ¿Recordaste tu contraseña?{' '}
            <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
          <p className="mt-1">&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
        </footer>
      </main>
    </div>
  );
}
