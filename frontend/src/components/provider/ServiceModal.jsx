// frontend/src/components/provider/ServiceModal.jsx

import React, { useState, useEffect } from 'react';

const ServiceModal = ({ isOpen, onClose, onSave, serviceToEdit }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    duracion_minutos: '',
    precio: '',
    is_active: true,
  });

  // Efecto para llenar el formulario cuando se edita un servicio
  useEffect(() => {
    if (serviceToEdit) {
      setFormData({
        nombre: serviceToEdit.nombre || '',
        descripcion: serviceToEdit.descripcion || '',
        duracion_minutos: serviceToEdit.duracion_minutos || '',
        precio: serviceToEdit.precio || '',
        is_active: serviceToEdit.is_active !== undefined ? serviceToEdit.is_active : true,
      });
    } else {
      // Limpiar formulario si no se está editando (modo creación)
      setFormData({
        nombre: '',
        descripcion: '',
        duracion_minutos: '',
        precio: '',
        is_active: true,
      });
    }
  }, [serviceToEdit, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí puedes añadir validación antes de guardar
    onSave(formData);
  };

  if (!isOpen) {
    return null; // No renderizar nada si el modal está cerrado
  }

  // Usamos clases de Tailwind para el fondo oscuro y el centrado
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">
          {serviceToEdit ? 'Editar Servicio' : 'Añadir Nuevo Servicio'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          {/* Nombre del Servicio */}
          <div className="mb-4">
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre del Servicio</label>
            <input
              type="text"
              name="nombre"
              id="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          {/* Duración y Precio (en la misma fila) */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="duracion_minutos" className="block text-sm font-medium text-gray-700">Duración (minutos)</label>
              <input
                type="number"
                name="duracion_minutos"
                id="duracion_minutos"
                value={formData.duracion_minutos}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="precio" className="block text-sm font-medium text-gray-700">Precio (€)</label>
              <input
                type="number"
                name="precio"
                id="precio"
                step="0.01"
                value={formData.precio}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="mb-4">
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">Descripción (opcional)</label>
            <textarea
              name="descripcion"
              id="descripcion"
              rows="3"
              value={formData.descripcion}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            ></textarea>
          </div>

          {/* Estado Activo */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-900">Servicio activo</span>
            </label>
          </div>
          
          {/* Botones de acción */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
            >
              {serviceToEdit ? 'Guardar Cambios' : 'Crear Servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;