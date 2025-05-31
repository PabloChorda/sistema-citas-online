// src/pages/RegisterProvider.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import { registerProvider } from '../services/authService';

function RegisterProvider() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    business_name: '',
    business_type: '',
    timezone: 'Europe/Madrid',
    address: '',
    bio: ''
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await registerProvider(form);
      setMessage('Registro exitoso. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage(error.message || 'Error al registrar proveedor.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Registro de Proveedor</h1>
        <form onSubmit={handleSubmit}>
          <label>Email:
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Contraseña:
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </label>
          <label>Nombre:
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
          </label>
          <label>Apellidos:
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
          </label>
          <label>Nombre del negocio:
            <input type="text" name="business_name" value={form.business_name} onChange={handleChange} required />
          </label>
          <label>Tipo de negocio:
            <input type="text" name="business_type" value={form.business_type} onChange={handleChange} required />
          </label>
          <label>Dirección:
            <input type="text" name="address" value={form.address} onChange={handleChange} required />
          </label>
          <label>Biografía o descripción:
            <textarea name="bio" value={form.bio} onChange={handleChange} required rows="3" />
          </label>
          <button type="submit">Registrar proveedor</button>
        </form>
        {message && <p className="login-message">{message}</p>}

        <p className="register-link">
          ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </main>

      <footer className="login-footer">
        <p>¿Necesitas ayuda? <a href="mailto:soporte@citafacil.com">Contáctanos</a></p>
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default RegisterProvider;
