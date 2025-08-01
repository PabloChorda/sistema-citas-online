// frontend/src/components/availability/AvailabilityModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import ReactDOM from 'react-dom';
import { generateTimeSlots } from '../../utils/time';
import Button from '../ui/Button'; // Importamos el componente Button para consistencia

const AvailabilityModal = ({ isOpen, onClose, onSave, ruleToEdit, day }) => {
  // Generamos la lista de horarios en un rango razonable (7am a 11pm)
  const timeSlots = useMemo(() => generateTimeSlots({
    intervalMinutes: 15,
    startHour: 7,
    endHour: 23,
  }), []);
  
  const [formData, setFormData] = useState({
    hora_inicio: '09:00',
    hora_fin: '17:00',
  });

  useEffect(() => {
    if (ruleToEdit) {
      setFormData({
        hora_inicio: ruleToEdit.hora_inicio.slice(0, 5),
        hora_fin: ruleToEdit.hora_fin.slice(0, 5),
      });
    } else {
      setFormData({
        hora_inicio: '09:00',
        hora_fin: '17:00',
      });
    }
  }, [ruleToEdit, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.hora_fin <= formData.hora_inicio) {
        toast.error("La hora de fin debe ser posterior a la hora de inicio.");
        return;
    }
    const finalData = { ...formData };
    if (!ruleToEdit && day) {
      finalData.dia_semana = day;
    }
    onSave(finalData);
  };
  

  if (!isOpen) {
    return null;
  }

  const title = ruleToEdit ? 'Editar Horario' : `Añadir Horario para ${day}`;

  // Envolvemos el JSX en ReactDOM.createPortal
  return ReactDOM.createPortal(
    (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="hora_inicio" className="block text-sm font-medium text-gray-700">Desde</label>
                <select
                  name="hora_inicio"
                  id="hora_inicio"
                  value={formData.hora_inicio}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                >
                  {timeSlots.map(slot => <option key={`start-${slot}`} value={slot}>{slot}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="hora_fin" className="block text-sm font-medium text-gray-700">Hasta</label>
                <select
                  name="hora_fin"
                  id="hora_fin"
                  value={formData.hora_fin}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                >
                  {timeSlots.map(slot => <option key={`end-${slot}`} value={slot}>{slot}</option>)}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Guardar
              </Button>
            </div>
          </form>
        </div>
      </div>
    ),
    // El destino del portal
    document.getElementById('modal-portal')
  );
};

export default AvailabilityModal;