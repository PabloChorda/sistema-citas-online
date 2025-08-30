// frontend/src/components/provider/StaffModal.jsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';

const StaffModal = ({
  isOpen,
  onClose,
  onSave,
  staffToEdit = null,
  availableServices = [],
  isSubmitting = false, // ahora lo usamos para deshabilitar la UI mientras se guarda
}) => {
  const [formData, setFormData] = useState({});
  const [initialData, setInitialData] = useState({});
  const isEditing = !!staffToEdit;

  useEffect(() => {
    if (!isOpen) return;

    let data;
    if (isEditing) {
      // Modo edición
      data = {
        first_name: staffToEdit.first_name || '',
        last_name: staffToEdit.last_name || '',
        email: staffToEdit.email || '',
        rol: staffToEdit.rol || '',
        service_ids: staffToEdit.service_ids || [],
        activo: staffToEdit.activo !== undefined ? !!staffToEdit.activo : true,
        password: '',
      };
    } else {
      // Modo creación
      data = {
        email: '',
        first_name: '',
        last_name: '',
        rol: '',
        password: '',
        service_ids: [],
        activo: true,
      };
    }
    setFormData(data);
    setInitialData(data);
  }, [isOpen, isEditing, staffToEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleServiceChange = (serviceId) => {
    setFormData((prev) => {
      const current = prev.service_ids || [];
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, service_ids: next };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isEditing && (formData.password || '').length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const dataToSend = { ...formData };
    if (isEditing) {
      // No permitimos cambiar email y password en edición desde este modal
      delete dataToSend.email;
      delete dataToSend.password;
    }
    onSave(dataToSend, staffToEdit?.id);
  };

  const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialData);

  if (!isOpen) return null;

  const portalNode = document.getElementById('modal-portal');
  if (!portalNode) {
    // Fallback: devuelve el contenido directamente si no existe el portal
    return (
      <div className="staff-modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg max-h-screen overflow-y-auto">
          <FormContent
            isEditing={isEditing}
            formData={formData}
            availableServices={availableServices}
            handleChange={handleChange}
            handleServiceChange={handleServiceChange}
            handleSubmit={handleSubmit}
            onClose={onClose}
            hasChanged={hasChanged}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    );
  }

  return ReactDOM.createPortal(
    <div className="staff-modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg max-h-screen overflow-y-auto">
        <FormContent
          isEditing={isEditing}
          formData={formData}
          availableServices={availableServices}
          handleChange={handleChange}
          handleServiceChange={handleServiceChange}
          handleSubmit={handleSubmit}
          onClose={onClose}
          hasChanged={hasChanged}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>,
    portalNode
  );
};

function FormContent({
  isEditing,
  formData,
  availableServices,
  handleChange,
  handleServiceChange,
  handleSubmit,
  onClose,
  hasChanged,
  isSubmitting,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
      <h2 className="text-2xl font-bold mb-6">
        {isEditing ? 'Editar Empleado' : 'Añadir Nuevo Empleado'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <Input
            type="text"
            name="first_name"
            id="first_name"
            value={formData.first_name ?? ''}
            onChange={handleChange}
            required
            className="mt-1"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
            Apellidos
          </label>
          <Input
            type="text"
            name="last_name"
            id="last_name"
            value={formData.last_name ?? ''}
            onChange={handleChange}
            required
            className="mt-1"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email de Acceso
        </label>
        <Input
          type="email"
          name="email"
          id="email"
          value={formData.email ?? ''}
          onChange={handleChange}
          required
          disabled={isEditing || isSubmitting}
          className="mt-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {!isEditing && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña Temporal
          </label>
          <Input
            type="password"
            name="password"
            id="password"
            value={formData.password ?? ''}
            onChange={handleChange}
            required
            className="mt-1"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            El empleado podrá cambiar esta contraseña al iniciar sesión.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="rol" className="block text-sm font-medium text-gray-700">
          Rol / Cargo
        </label>
        <Input
          type="text"
          name="rol"
          id="rol"
          placeholder="Ej: Estilista, Masajista"
          value={formData.rol ?? ''}
          onChange={handleChange}
          required
          className="mt-1"
          disabled={isSubmitting}
        />
      </div>

      <div className="pt-2">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Servicios que realiza</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto border p-3 rounded-md bg-gray-50">
          {availableServices.length > 0 ? (
            availableServices.map((service) => (
              <label key={service.id} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={(formData.service_ids || []).includes(service.id)}
                  onChange={() => handleServiceChange(service.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  disabled={isSubmitting}
                />
                <span className="ml-3 text-sm text-gray-800">{service.nombre}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              No hay servicios creados en este establecimiento para asignar.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={(isEditing && !hasChanged) || isSubmitting}
        >
          {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar Cambios' : 'Crear Empleado'}
        </Button>
      </div>
    </form>
  );
}

export default StaffModal;
