// frontend/src/pages/Register.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerUser } from '../services/authService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

function Register() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await registerUser(formData);
      toast.success(data.msg || '¡Registro exitoso! Revisa tu email para validar la cuenta.');

      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      toast.error(err.message || 'Ocurrió un error durante el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="login-container">
        <main className="login-box">
          <header className="login-header">
            <h1>Crear Cuenta de Cliente</h1>
            <p>Únete para empezar a reservar tus citas</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              name="first_name"
              placeholder="Nombre"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            <Input
              type="text"
              name="last_name"
              placeholder="Apellidos"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
            <Input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            {/* Campo contraseña con mostrar/ocultar */}
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleChange}
                required
                className="pr-11" // deja espacio al icono
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-2 my-auto inline-flex items-center justify-center text-gray-500 hover:text-gray-700 focus:ring-brand-500"
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>

            <Input
              type="tel"
              name="phone_number"
              placeholder="Teléfono (Opcional)"
              value={formData.phone_number}
              onChange={handleChange}
            />

            <div className="pt-2 flex justify-center">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrarse'}
              </Button>
            </div>
          </form>

          <footer className="login-footer">
            <p>
              ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Register;
