// src/pages/RegisterProvider.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import { registerProvider } from '../services/authService';

function RegisterProvider() {
  const navigate = useNavigate();

  // --- CORRECCIÓN ---
  // Estado actualizado con TODOS los campos del backend y los nombres correctos.
  const [form, setForm] = useState({
    // Campos para el modelo User
    email: '',
    password: '',
    first_name: '', // Nombre del titular de la cuenta
    last_name: '',  // Apellido del titular

    // Campos para el modelo Provider
    nombre_comercial: '', // antes era business_name
    cif: '',              // CAMPO AÑADIDO (Obligatorio)
    tipo_empresa: '',     // antes era business_type
    direccion_fiscal: '', // antes era address
    telefono_contacto: '',// CAMPO AÑADIDO
    email_contacto: '',   // CAMPO AÑADIDO
    web: '',              // CAMPO AÑADIDO
    bio: '',
    idiomas_hablados: '', // CAMPO AÑADIDO (se envía como string)
    timezone: 'Europe/Madrid', // Valor por defecto
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Creamos una copia del payload para procesarlo si es necesario
      const payload = { ...form };
      
      // El backend espera un array para idiomas_hablados. Convertimos el string en un array.
      payload.idiomas_hablados = payload.idiomas_hablados.split(',').map(lang => lang.trim());

      await registerProvider(payload);
      setMessage('Registro exitoso. Serás redirigido para iniciar sesión...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setMessage(error.message || 'Error al registrar el proveedor. Revisa los campos.');
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>📅 Registro de Proveedor en CitaFácil</h2>
      </header>

      <main className="login-container">
        <h1>Datos del Negocio</h1>
        <form onSubmit={handleSubmit}>
          
          {/* --- DATOS DEL NEGOCIO --- */}
          <label>Nombre Comercial:
            <input type="text" name="nombre_comercial" value={form.nombre_comercial} onChange={handleChange} required />
          </label>
          <label>CIF / NIF:
            <input type="text" name="cif" value={form.cif} onChange={handleChange} required />
          </label>
          <label>Tipo de Empresa (Ej: Peluquería, Taller...):
            <input type="text" name="tipo_empresa" value={form.tipo_empresa} onChange={handleChange} />
          </label>
          <label>Dirección Fiscal Completa:
            <input type="text" name="direccion_fiscal" value={form.direccion_fiscal} onChange={handleChange} />
          </label>
          <label>Página Web:
            <input type="url" name="web" placeholder="https://ejemplo.com" value={form.web} onChange={handleChange} />
          </label>
          <label>Biografía o Descripción del Negocio:
            <textarea name="bio" value={form.bio} onChange={handleChange} rows="3" />
          </label>
          <label>Idiomas hablados (separados por comas):
            <input type="text" name="idiomas_hablados" placeholder="Español, Inglés" value={form.idiomas_hablados} onChange={handleChange} />
          </label>

          {/* --- DATOS DE CONTACTO Y ACCESO --- */}
          <h2 style={{width: '100%', textAlign: 'center', margin: '30px 0 20px', fontSize: '20px', color: '#4f46e5'}}>Datos de Contacto y Cuenta</h2>
          
          <label>Email de Acceso (Login):
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Contraseña:
            <input type="password" name="password" value={form.password} onChange={handleChange} required minLength="6" />
          </label>
          <label>Nombre (Persona de contacto):
            <input type="text" name="first_name" value={form.first_name} onChange={handleChange} required />
          </label>
          <label>Apellidos (Persona de contacto):
            <input type="text" name="last_name" value={form.last_name} onChange={handleChange} required />
          </label>
          <label>Teléfono de Contacto Público:
            <input type="tel" name="telefono_contacto" value={form.telefono_contacto} onChange={handleChange} />
          </label>
           <label>Email de Contacto Público:
            <input type="email" name="email_contacto" value={form.email_contacto} onChange={handleChange} />
          </label>

          <button type="submit">Crear Cuenta de Proveedor</button>
        </form>
        {message && <p className="login-message">{message}</p>}

        <p className="register-link" style={{marginTop: '20px'}}>
          ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </main>

      <footer className="login-footer">
        <p>&copy; {new Date().getFullYear()} CitaFácil. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default RegisterProvider;