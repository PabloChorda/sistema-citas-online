// src/pages/CreateEstablishment.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEstablishment } from '../services/establishmentsService';

function CreateEstablishment() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    provider_id: '',   // Asegúrate de tener esto (puede venir de un user logueado)
    nombre: '',
    direccion_completa: '',
    codigo_postal: '',
    provincia: '',
    localidad: '',
    telefono: '',
    email: '',
    web: '',
    descripcion_publica: '',
    abre_sabados: false,
    cierra_sabado: false,
    idiomas_hablados: '', // Como string, se convertirá a array
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        idiomas_hablados: form.idiomas_hablados
          ? form.idiomas_hablados.split(',').map(str => str.trim())
          : []
      };

      payload.provider_id = parseInt(payload.provider_id); // Asegúrate que sea número

      await createEstablishment(payload);
      setMessage('✅ Establecimiento creado exitosamente.');
      setTimeout(() => navigate('/dashboard'), 3000); // Redireccionar si quieres
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="page-wrapper">
      <header className="login-header">
        <h2>🏢 Nuevo Establecimiento</h2>
      </header>

      <main className="login-container">
        <form onSubmit={handleSubmit}>
          <label>ID del Proveedor:
            <input type="number" name="provider_id" value={form.provider_id} onChange={handleChange} required />
          </label>

          <label>Nombre del Establecimiento:
            <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required />
          </label>

          <label>Dirección Completa:
            <input type="text" name="direccion_completa" value={form.direccion_completa} onChange={handleChange} required />
          </label>

          <label>Código Postal:
            <input type="text" name="codigo_postal" value={form.codigo_postal} onChange={handleChange} />
          </label>

          <label>Provincia:
            <input type="text" name="provincia" value={form.provincia} onChange={handleChange} required />
          </label>

          <label>Localidad:
            <input type="text" name="localidad" value={form.localidad} onChange={handleChange} required />
          </label>

          <label>Teléfono:
            <input type="text" name="telefono" value={form.telefono} onChange={handleChange} />
          </label>

          <label>Email:
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </label>

          <label>Web:
            <input type="url" name="web" value={form.web} onChange={handleChange} />
          </label>

          <label>Descripción Pública:
            <textarea name="descripcion_publica" value={form.descripcion_publica} onChange={handleChange} rows="3" />
          </label>

          <label>Idiomas Hablados (separados por coma):
            <input type="text" name="idiomas_hablados" value={form.idiomas_hablados} onChange={handleChange} />
          </label>

          <label>
            <input type="checkbox" name="abre_sabados" checked={form.abre_sabados} onChange={handleChange} />
            ¿Abre los sábados?
          </label>

          <label>
            <input type="checkbox" name="cierra_sabado" checked={form.cierra_sabado} onChange={handleChange} />
            ¿Cierra los sábados?
          </label>

          <button type="submit">Crear Establecimiento</button>
        </form>

        {message && <p className="login-message">{message}</p>}
      </main>

      <footer className="login-footer">
        <p>&copy; {new Date().getFullYear()} CitaFácil</p>
      </footer>
    </div>
  );
}

export default CreateEstablishment;
