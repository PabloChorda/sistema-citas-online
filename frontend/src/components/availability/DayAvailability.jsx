// frontend/src/components/availability/DayAvailability.jsx

import React from 'react';
// --- LÍNEA DE IMPORTACIÓN AÑADIDA ---
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/solid';

// Componente para una única franja horaria
const TimeSlot = ({ rule, onEdit, onDelete }) => (
  <div className="flex items-center justify-between bg-indigo-50 rounded-lg p-2 mt-2">
    <span className="font-mono text-indigo-800">
      {rule.hora_inicio.slice(0, 5)} - {rule.hora_fin.slice(0, 5)}
    </span>
    <div className="flex space-x-2">
      <button onClick={() => onEdit(rule)} className="text-gray-500 hover:text-gray-800" title="Editar horario">
        <PencilIcon className="h-4 w-4" />
      </button>
      <button onClick={() => onDelete(rule.id)} className="text-red-500 hover:text-red-700" title="Eliminar horario">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
);

// Componente principal para un día
const DayAvailability = ({ dayName, rules, onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-700">{dayName}</h3>
        <button
          onClick={() => onAdd(dayName.toUpperCase())}
          className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Añadir
        </button>
      </div>
      <div className="mt-4">
        {rules.length > 0 ? (
          rules.map(rule => (
            <TimeSlot key={rule.id} rule={rule} onEdit={onEdit} onDelete={onDelete} />
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No hay horarios definidos.</p>
        )}
      </div>
    </div>
  );
};

export default DayAvailability;