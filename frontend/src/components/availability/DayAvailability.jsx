// frontend/src/components/availability/DayAvailability.jsx

import React from 'react';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/solid';

const TimeSlot = ({ rule, onEdit, onDelete }) => (
  <div className="flex items-center justify-between bg-gray-100 rounded-md px-3 py-1.5 mt-2">
    <span className="font-mono text-sm text-gray-800">
      {rule.hora_inicio.slice(0, 5)} - {rule.hora_fin.slice(0, 5)}
    </span>
    <div className="flex space-x-3">
      <button onClick={() => onEdit(rule)} className="text-gray-500 hover:text-indigo-600" title="Editar horario">
        <PencilIcon className="h-4 w-4" />
      </button>
      <button onClick={() => onDelete(rule.id)} className="text-gray-500 hover:text-red-600" title="Eliminar horario">
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const DayAvailability = ({ dayName, rules, onAdd, onEdit, onDelete }) => {
  return (
    // Reemplazamos la tarjeta por una fila de la lista
    <div className="py-4 px-6 flex flex-col md:flex-row md:items-start">
      {/* Columna 1: Nombre del día */}
      <div className="font-semibold text-gray-800 w-full md:w-1/4 mb-2 md:mb-0 md:pt-2">
        {dayName}
      </div>
      
      {/* Columna 2: Lista de horarios y botón de añadir */}
      <div className="w-full md:w-3/4">
        {rules.length > 0 ? (
          rules.map(rule => (
            <TimeSlot key={rule.id} rule={rule} onEdit={onEdit} onDelete={onDelete} />
          ))
        ) : (
          <p className="text-sm text-gray-400 italic pt-2">No disponible</p>
        )}
        <button
          onClick={() => onAdd(dayName.toUpperCase())}
          className="mt-2 flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Añadir horario
        </button>
      </div>
    </div>
  );
};

export default DayAvailability;