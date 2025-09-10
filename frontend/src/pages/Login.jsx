// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser, loginWithGoogle } from '../services/authService';
import GoogleLoginComponent from "./GoogleLoginComponent";
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';

// Util: decodifica el JWT (solo payload)
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return json || null;
  } catch {
    return null;
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshMe } = useAuth(); // 👈 clave

  const persistAuth = (accessToken, refreshToken, role) => {
    // Guardamos en ambas claves por compat (métricas/legacy)
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('accessToken', accessToken);
      const a = decodeJwt(accessToken);
      if (a?.exp) localStorage.setItem('access_exp', String(a.exp));
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('refreshToken', refreshToken);
      const r = decodeJwt(refreshToken);
      if (r?.exp) localStorage.setItem('refresh_exp', String(r.exp));
    }
    // (opcional) legacy
    if (role) localStorage.setItem('userRole', role);

    // Disparar un "storage" sintético para oyentes en esta misma pestaña
    try { window.dispatchEvent(new Event('storage')); } catch {}
  };

  const redirectAfterLogin = () => {
    const nextFromQuery = new URLSearchParams(location.search).get('next');
    const fromState = location.state?.from?.pathname;
    const target = nextFromQuery || fromState || '/dashboard';
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await loginUser(email, password); // {access_token, refresh_token, role, ...}
      persistAuth(data.access_token, data.refresh_token, data.role);

      // 🔁 Pedimos el /auth/me actualizado antes de navegar
      await refreshMe();

      toast.success('¡Bienvenido/a de nuevo!');
      redirectAfterLogin();
    } catch (error) {
      toast.error(error?.message || "Error al iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async (googleToken) => {
    setSubmitting(true);
    try {
      const data = await loginWithGoogle(googleToken);
      persistAuth(data.access_token, data.refresh_token, data.role);

      await refreshMe();

      toast.success('¡Bienvenido/a de nuevo!');
      redirectAfterLogin();
    } catch (error) {
      toast.error(error?.message || "Error en el inicio con Google.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="min-h-screen flex items-center justify-center px-4">
        <main className="w-full max-w-md bg-white rounded-lg shadow-md p-8 space-y-6">
          <header className="text-center">
            <h1 className="text-2xl font-semibold text-gray-800">Iniciar Sesión</h1>
            <p className="text-sm text-gray-500 mt-1">
              Accede a tu cuenta para gestionar tus citas
            </p>
          </header>

          <div className="flex justify-center">
            <GoogleLoginComponent onLogin={handleGoogleLogin} />
          </div>

          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <hr className="flex-grow border-gray-200" />
            <span>O</span>
            <hr className="flex-grow border-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <footer className="text-sm text-center text-gray-600 space-y-2">
            <p>
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-semibold text-brand-500 hover:underline">
                Regístrate
              </Link>
            </p>
            <p>
              ¿Eres proveedor?{' '}
              <Link
                to="/register/provider"
                className="font-semibold text-brand-500 hover:underline"
              >
                Regístrate como proveedor
              </Link>
            </p>
            <p>
              <Link
                to="/register/reset-password"
                className="font-semibold text-brand-500 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
