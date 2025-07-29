// frontend/src/pages/EditEstablishment.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEstablishmentById, updateEstablishment } from '../services/establishmentService';

const EditEstablishment = () => {
  // Hooks para obtener el ID de la URL y para la navegación
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  
  // Estado para los datos del formulario. Lo inicializamos vacío para evitar errores de "uncontrolled component"
  const [formData, setFormData] = useState({
    nombre: '',
    direccion_completa: '',
    provincia: '',
    localidad: '',
    codigo_postal: '',
    telefono: '',
    email: '',
    activo: true, // Añadimos el estado 'activo'
  });

  // Estados para controlar la carga y los errores
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // useEffect para cargar los datos del establecimiento cuando el componente se monta o el ID cambia
  useEffect(() => {
    const fetchEstablishment = async () => {
      try {
        setLoading(true);
        // Usamos establishmentId, que es más descriptivo
        const data = await getEstablishmentById(establishmentId);
        setFormData({
            nombre: data.nombre || '',
            direccion_completa: data.direccion_completa || '',
            provincia: data.provincia || '',
            localidad: data.localidad || '',
            codigo_postal: data.codigo_postal || '',
            telefono: data.telefono || '',
            email: data.email || '',
            activo: data.activo !== undefined ? data.activo : true,
        });
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los datos del establecimiento.');
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishment();
  }, [establishmentId]); // La dependencia ahora es establishmentId

  // Maneja los cambios en cualquier campo del formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Maneja el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateEstablishment(establishmentId, formData);
      // --- RUTA DE REDIRECCIÓN CORREGIDA ---
      navigate('/dashboard/provider/establishments'); // Volver a la lista tras el éxito
    } catch (err) {
      setError(err.message || 'Error al actualizar el establecimiento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-wrapper"><p className="p-4">Cargando datos del establecimiento...</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Editar Establecimiento</h1>
        {/* Usamos el nombre del estado para que el título se actualice si el usuario lo cambia */}
        <p>Actualiza la información de "{formData.nombre || '...'}"</p>
      </header>

      <div className="profile-card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nombre */}
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del establecimiento</label>
            <input type="text" name="nombre" id="nombre" required value={formData.nombre} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          
          {/* Dirección */}
          <div>
            <label htmlFor="direccion_completa" className="block text-sm font-medium text-gray-700">Dirección completa</label>
            <input type="text" name="direccion_completa" id="direccion_completa" required value={formData.direccion_completa} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          
          {/* Provincia y Localidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="provincia" className="block text-sm font-medium text-gray-700">Provincia</label>
              <input type="text" name="provincia" id="provincia" required value={formData.provincia} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="localidad" className="block text-sm font-medium text-gray-700">Localidad</label>
              <input type="text" name="localidad" id="localidad" required value={formData.localidad} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
          </div>

          {/* Código Postal y Teléfono */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="codigo_postal" className="block text-sm font-medium text-gray-700">Código Postal</label>
              <input type="text" name="codigo_postal" id="codigo_postal" value={formData.codigo_postal} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input type="tel" name="telefono" id="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
          </div>

          {/* Estado 'Activo' */}
          <div className="pt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="activo"
                checked={formData.activo}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-3 text-sm text-gray-900">Establecimiento activo (visible para clientes)</span>
            </label>
          </div>

          {/* Mensaje de Error */}
          {error && <p className="error-message">{error}</p>}
          
          {/* Botones de Acción */}
          <div className="flex justify-end pt-4 space-x-4">
            <button type="button" onClick={() => navigate('/dashboard/provider/establishments')} className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEstablishment;