// frontend/src/components/availability/AvailabilityModal.jsx

import React, { useState, useEffect } from 'react';

const AvailabilityModal = ({ isOpen, onClose, onSave, ruleToEdit, day }) => {
  const [formData, setFormData] = useState({
    hora_inicio: '',
    hora_fin: '',
  });

  useEffect(() => {
    if (ruleToEdit) {
      // Modo Edición: cargamos los datos de la regla existente
      setFormData({
        hora_inicio: ruleToEdit.hora_inicio.slice(0, 5), // Formato HH:MM
        hora_fin: ruleToEdit.hora_fin.slice(0, 5),
      });
    } else {
      // Modo Creación: reseteamos el formulario
      setFormData({
        hora_inicio: '',
        hora_fin: '',
      });
    }
  }, [ruleToEdit, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = { ...formData };

    // Si estamos en modo creación, añadimos el día de la semana
    if (!ruleToEdit && day) {
      finalData.dia_semana = day;
    }
    
    onSave(finalData);
  };

  if (!isOpen) return null;

  const title = ruleToEdit ? 'Editar Horario' : `Añadir Horario para ${day}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="hora_inicio" className="block text-sm font-medium text-gray-700">Hora de Inicio</label>
              <input
                type="time"
                name="hora_inicio"
                id="hora_inicio"
                value={formData.hora_inicio}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="hora_fin" className="block text-sm font-medium text-gray-700">Hora de Fin</label>
              <input
                type="time"
                name="hora_fin"
                id="hora_fin"
                value={formData.hora_fin}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700">
              Guardar Horario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AvailabilityModal;