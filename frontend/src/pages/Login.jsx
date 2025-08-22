// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginUser, loginWithGoogle } from '../services/authService';
import GoogleLoginComponent from "./GoogleLoginComponent";
import Button from '../components/ui/Button';
import Input from '../components/ui/Input'; 

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const persistAuth = (accessToken, role) => {
    // Guardamos en ambas claves para compatibilidad con /admin/metrics
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('userRole', role || '');
    // Y notificamos al contenedor (App) para que actualice estado
    if (typeof onLogin === 'function') onLogin(accessToken, role);
  };

  const redirectAfterLogin = () => {
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await loginUser(email, password);
      persistAuth(data.access_token, data.role);
      toast.success('¡Bienvenido/a de nuevo!');
      redirectAfterLogin();
    } catch (error) {
      toast.error(error.message || "Error al iniciar sesión.");
    }
  };

  const handleGoogleLogin = async (googleToken) => {
    try {
      const data = await loginWithGoogle(googleToken);
      persistAuth(data.access_token, data.role);
      toast.success('¡Bienvenido/a de nuevo!');
      redirectAfterLogin();
    } catch (error) {
      toast.error(error.message || "Error en el inicio con Google.");
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
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" className="w-full">
              Entrar
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

export default Login;
