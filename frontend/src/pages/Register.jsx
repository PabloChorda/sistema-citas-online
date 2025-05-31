// src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css'; // Reutilizamos el mismo CSS
import { registerUser } from '../services/authService';

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    password: '',
    telefono: '',
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await registerUser(form);
      setMessage('Registro exitoso. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage(error.message || 'Error al registrar usuario.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Crear cuenta</h1>
        <form onSubmit={handleSubmit}>
          <label>Nombre:
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
          </label>
          <label>Apellidos:
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
          </label>
          <label>Email:
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Contraseña:
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </label>
          <label>Teléfono:
            <input type="tel" name="phone_number" value={form.phone_number} onChange={handleChange} />
          </label>
          <button type="submit">Registrarse</button>
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

export default Register;
