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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const data = await loginUser(email, password);
        onLogin(data.access_token, data.role);
        
        toast.success('¡Bienvenido/a de nuevo!');

        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
    } catch (error) {
        toast.error(error.message || "Error al iniciar sesión. Revisa tus credenciales.");
    }
  };

  const handleGoogleLogin = async (googleToken) => {
    try {
      const data = await loginWithGoogle(googleToken);
      onLogin(data.access_token, data.role);

      toast.success('¡Bienvenido/a de nuevo!');

      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });

    } catch (error) {
      toast.error(error.message || "Error en el inicio de sesión con Google.");
    }
  };

  return (
    <div className="login-container">
      <main className="login-box">
        <header className="login-header">
          <h1>Iniciar Sesión</h1>
          <p>Accede a tu cuenta para gestionar tus citas</p>
        </header>
        
        <div style={{ alignSelf: 'center', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <GoogleLoginComponent onLogin={handleGoogleLogin} />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', color: '#9ca3af', margin: '0 0 1.5rem 0' }}>
          <hr style={{ flexGrow: 1, borderTop: '1px solid #e5e7eb' }} />
          <span style={{ padding: '0 1rem', fontSize: '0.9rem' }}>O</span>
          <hr style={{ flexGrow: 1, borderTop: '1px solid #e5e7eb' }} />
        </div>

        <form onSubmit={handleSubmit}>
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
          <Button type="submit" variant="primary">
            Entrar
          </Button>
        </form>
        
        <footer className="login-footer">
          <p>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
          <p>¿Eres proveedor? <Link to="/register/provider">Regístrate como proveedor</Link></p>
          <p><Link to="/register/reset-password">¿Olvidaste tu contraseña?</Link></p>
        </footer>
      </main>
    </div>
  );
}

export default Login;
