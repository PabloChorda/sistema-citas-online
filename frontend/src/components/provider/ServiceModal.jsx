// frontend/src/components/provider/ServiceModal.jsx

import React, { useState, useEffect, useRef } from 'react';
import Button from '../ui/Button';

const ServiceModal = ({ isOpen, onClose, onSave, serviceToEdit }) => {
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    duracion_minutos: '',
    precio: '',
    is_active: true,
  });

  // Rellena/limpia formulario al abrir/editar
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      nombre: serviceToEdit?.nombre || '',
      descripcion: serviceToEdit?.descripcion || '',
      duracion_minutos:
        serviceToEdit?.duracion_minutos !== undefined ? serviceToEdit.duracion_minutos : '',
      precio: serviceToEdit?.precio !== undefined ? serviceToEdit.precio : '',
      is_active:
        serviceToEdit?.is_active !== undefined ? serviceToEdit.is_active : true,
    });
  }, [serviceToEdit, isOpen]);

  // Autofocus primer campo (sin tocar el body overflow)
  useEffect(() => {
    if (!isOpen) return;
    firstFieldRef.current?.focus();
  }, [isOpen]);

  // Cerrar con ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Cerrar al hacer clic fuera
  const onOverlayMouseDown = (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
  };

  // Evitar burbujeo dentro del panel
  const stopMouseDown = (e) => e.stopPropagation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dur = Number(formData.duracion_minutos);
    const prc = Number(formData.precio);
    if (!Number.isFinite(dur) || dur <= 0) return;
    if (!Number.isFinite(prc) || prc < 0) return;
    onSave(formData);
  };

  if (!isOpen) return null;

  const titleId = 'service-modal-title';

  return (
    <div
      className="fixed inset-0 z-50 overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={onOverlayMouseDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Panel */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          onMouseDown={stopMouseDown}
          className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-card"
        >
          <h2 id={titleId} className="text-xl font-semibold text-gray-900">
            {serviceToEdit ? 'Editar Servicio' : 'Añadir Nuevo Servicio'}
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                Nombre del servicio
              </label>
              <input
                ref={firstFieldRef}
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Duración y Precio */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="duracion_minutos" className="block text-sm font-medium text-gray-700">
                  Duración (min)
                </label>
                <input
                  type="number"
                  id="duracion_minutos"
                  name="duracion_minutos"
                  min={1}
                  step={1}
                  value={formData.duracion_minutos}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label htmlFor="precio" className="block text-sm font-medium text-gray-700">
                  Precio (€)
                </label>
                <input
                  type="number"
                  id="precio"
                  name="precio"
                  min={0}
                  step="0.01"
                  value={formData.precio}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                rows={3}
                value={formData.descripcion}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Estado */}
            <div className="pt-1">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="ml-2 text-sm text-gray-900">Servicio activo</span>
              </label>
            </div>

            {/* Acciones */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="secondary">
                {serviceToEdit ? 'Guardar cambios' : 'Crear servicio'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ServiceModal;
