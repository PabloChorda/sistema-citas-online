// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import { loginUser, loginWithGoogle } from '../services/authService';
import GoogleLoginComponent from './GoogleLoginComponent';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

import { setAccessToken, setRefreshToken } from '../api/http';
import { useAuth } from '../context/AuthContext';
import DemoQuickLogin from "../components/demo/DemoQuickLogin";

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

// Next seguro: solo rutas internas que empiecen por "/" (y no "//")
function getSafeNext(location) {
  const sp = new URLSearchParams(location.search);
  const fromState = location.state?.from?.pathname;
  const candidate = sp.get('next') || fromState;
  if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }
  return '/dashboard';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { refreshMe } = useAuth();

  const persistTokens = (accessToken, refreshToken) => {
    if (accessToken) {
      setAccessToken(accessToken);
      // opcional: guardar exp por si quieres mostrar contadores
      const a = decodeJwt(accessToken);
      if (a?.exp) localStorage.setItem('access_exp', String(a.exp));
    }
    if (refreshToken) {
      setRefreshToken(refreshToken);
      const r = decodeJwt(refreshToken);
      if (r?.exp) localStorage.setItem('refresh_exp', String(r.exp));
    }
    // compat legacy para código viejo que aún lee userRole (no imprescindible)
    // si el backend lo devuelve en /auth/login:
    // localStorage.setItem('userRole', role || '');
  };

  const redirectAfterLogin = async () => {
    // Traemos /auth/me antes de navegar para que ProtectedRoute y el layout
    // ya tengan me listo y no “reboten”.
    try {
      await refreshMe();
    } catch {
      // si falla, navegamos igual; ProtectedRoute intentará refrescar luego
    }
    const next = getSafeNext(location);
    navigate(next, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // /auth/login → { access_token, refresh_token, role, ... }
      const data = await loginUser(email, password);
      persistTokens(data?.access_token, data?.refresh_token);
      toast.success('¡Bienvenido/a de nuevo!');
      await redirectAfterLogin();
    } catch (error) {
      toast.error(error?.message || 'Error al iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async (googleToken) => {
    setSubmitting(true);
    try {
      const data = await loginWithGoogle(googleToken);
      persistTokens(data?.access_token, data?.refresh_token);
      toast.success('¡Bienvenido/a de nuevo!');
      await redirectAfterLogin();
    } catch (error) {
      toast.error(error?.message || 'Error en el inicio con Google.');
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

          {/* Bloque de acceso rápido por token (solo aparece en VITE_DEMO_MODE=1) */}
          <DemoQuickLogin className="mt-4" />

          <footer className="text-sm text-center text-gray-600 space-y-2">
            <p>
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-semibold text-brand-500 hover:underline">
                Regístrate
              </Link>
            </p>
            <p>
              ¿Eres proveedor?{' '}
              <Link to="/register/provider" className="font-semibold text-brand-500 hover:underline">
                Regístrate como proveedor
              </Link>
            </p>
            <p>
              <Link to="/register/reset-password" className="font-semibold text-brand-500 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
