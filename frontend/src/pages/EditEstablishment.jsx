// frontend/src/pages/EditEstablishment.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast'; // Importamos toast
import { useNavigate, useParams } from 'react-router-dom';
import { getEstablishmentById, updateEstablishment } from '../services/establishmentService';

// Importamos nuestros componentes de UI
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const EditEstablishment = () => {
  const { establishmentId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nombre: '',
    direccion_completa: '',
    provincia: '',
    localidad: '',
    codigo_postal: '',
    telefono: '',
    email: '',
    activo: true,
  });

  const [loading, setLoading] = useState(true);
  // Ya no necesitamos el estado 'error', lo gestionará toast
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchEstablishment = async () => {
      try {
        setLoading(true);
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
        toast.error(err.message || 'No se pudieron cargar los datos del establecimiento.');
        // Si no se pueden cargar los datos, redirigimos al usuario
        navigate('/dashboard/provider/establishments');
      } finally {
        setLoading(false);
      }
    };
    fetchEstablishment();
  }, [establishmentId, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateEstablishment(establishmentId, formData);
      toast.success('¡Establecimiento actualizado con éxito!');
      navigate('/dashboard/provider/establishments');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar el establecimiento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-wrapper"><p className="p-4">Cargando datos del establecimiento...</p></div>;

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1>Editar Establecimiento</h1>
        <p>Actualiza la información de "{formData.nombre || '...'}"</p>
      </header>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del establecimiento</label>
            <Input type="text" name="nombre" id="nombre" required value={formData.nombre} onChange={handleChange} className="mt-1" />
          </div>
          
          <div>
            <label htmlFor="direccion_completa" className="block text-sm font-medium text-gray-700">Dirección completa</label>
            <Input type="text" name="direccion_completa" id="direccion_completa" required value={formData.direccion_completa} onChange={handleChange} className="mt-1" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="provincia" className="block text-sm font-medium text-gray-700">Provincia</label>
              <Input type="text" name="provincia" id="provincia" required value={formData.provincia} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <label htmlFor="localidad" className="block text-sm font-medium text-gray-700">Localidad</label>
              <Input type="text" name="localidad" id="localidad" required value={formData.localidad} onChange={handleChange} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="codigo_postal" className="block text-sm font-medium text-gray-700">Código Postal</label>
              <Input type="text" name="codigo_postal" id="codigo_postal" value={formData.codigo_postal} onChange={handleChange} className="mt-1" />
            </div>
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">Teléfono</label>
              <Input type="tel" name="telefono" id="telefono" value={formData.telefono} onChange={handleChange} className="mt-1" />
            </div>
          </div>

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
          
          <div className="flex justify-end pt-4 space-x-4">
            <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/provider/establishments')}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default EditEstablishment;