// frontend/src/pages/CreateEstablishment.jsx

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { createEstablishment } from '../services/establishmentService';

// Importamos nuestros componentes de UI
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

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
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createEstablishment(formData);
      
      toast.success('¡Establecimiento creado con éxito!');
      
      navigate('/dashboard/provider/establishments');
      
    } catch (err) {
      toast.error(err.message || 'Ocurrió un error al crear el establecimiento.');
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

      {/* Usamos el componente Card que creamos */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del establecimiento</label>
            {/* Usamos el componente Input */}
            <Input type="text" name="nombre" id="nombre" required onChange={handleChange} value={formData.nombre} className="mt-1" />
          </div>
          <div>
            <label htmlFor="direccion_completa" className="block text-sm font-medium text-gray-700">Dirección completa</label>
            <Input type="text" name="direccion_completa" id="direccion_completa" required onChange={handleChange} value={formData.direccion_completa} className="mt-1" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label htmlFor="provincia" className="block text-sm font-medium text-gray-700">Provincia</label>
                <Input type="text" name="provincia" id="provincia" required onChange={handleChange} value={formData.provincia} className="mt-1" />
            </div>
            <div>
                <label htmlFor="localidad" className="block text-sm font-medium text-gray-700">Localidad</label>
                <Input type="text" name="localidad" id="localidad" required onChange={handleChange} value={formData.localidad} className="mt-1" />
            </div>
          </div>

          
          <div className="flex justify-end pt-4 space-x-4">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => navigate('/dashboard/provider/establishments')}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar Establecimiento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateEstablishment;