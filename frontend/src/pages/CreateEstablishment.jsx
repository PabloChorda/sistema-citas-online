// frontend/src/pages/CreateEstablishment.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// --- 1. IMPORTAMOS NUESTRA NUEVA FUNCIÓN DE SERVICIO ---
import { createEstablishment } from '../services/establishmentService';

const CreateEstablishment = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    direccion_completa: '',
    provincia: '',
    localidad: '',
    codigo_postal: '',
    telefono: '',
    email: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // LLAMADA REAL A LA API ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createEstablishment(formData);
      
      // Si todo va bien, navegamos de vuelta a la lista de establecimientos
      navigate('/dashboard/provider/establishments');
      
    } catch (err) {
      // Si la API devuelve un error, lo mostramos al usuario
      setError(err.message || 'Ocurrió un error al crear el establecimiento.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Añadir Nuevo Establecimiento</h1>
        <p>Completa los datos de tu nuevo local.</p>
      </header>

      <div className="profile-card">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del establecimiento</label>
            <input type="text" name="nombre" id="nombre" required onChange={handleChange} value={formData.nombre} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="direccion_completa" className="block text-sm font-medium text-gray-700">Dirección completa</label>
            <input type="text" name="direccion_completa" id="direccion_completa" required onChange={handleChange} value={formData.direccion_completa} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="provincia" className="block text-sm font-medium text-gray-700">Provincia</label>
                <input type="text" name="provincia" id="provincia" required onChange={handleChange} value={formData.provincia} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
                <label htmlFor="localidad" className="block text-sm font-medium text-gray-700">Localidad</label>
                <input type="text" name="localidad" id="localidad" required onChange={handleChange} value={formData.localidad} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            {/* Puedes añadir más campos opcionales como código postal, teléfono, email aquí si quieres */}
          </div>

          {error && <p className="error-message">{error}</p>}
          
          <div className="flex justify-end pt-4">
            <button type="submit" disabled={submitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300">
              {submitting ? 'Guardando...' : 'Guardar Establecimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEstablishment;