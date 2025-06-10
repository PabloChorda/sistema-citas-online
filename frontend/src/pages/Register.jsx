// src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css'; // Reutilizamos el mismo CSS
import { registerUser } from '../services/authService';

function Register() {
  const navigate = useNavigate();

  // --- CORRECCIÓN ---
  // Las claves del estado deben coincidir exactamente con el atributo "name" de cada input.
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // El objeto 'form' ahora tiene los nombres de campo correctos que espera el backend.
      // ej: { first_name: "Juan", last_name: "Pérez", ... }
      await registerUser(form); 
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
            {/* El atributo name="first_name" ahora coincide con la clave del estado */}
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
          </label>
          <label>Apellidos:
            {/* El atributo name="last_name" ahora coincide con la clave del estado */}
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
          </label>
          <label>Email:
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Contraseña:
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength="6"/>
          </label>
          <label>Teléfono:
             {/* El atributo name="phone_number" ahora coincide con la clave del estado */}
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