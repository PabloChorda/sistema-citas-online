// frontend/src/components/provider/ServiceListItem.jsx

import React from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const ServiceListItem = ({ service, onEdit, onDelete }) => {
  const { id, nombre, duracion_minutos, precio, is_active } = service;

  return (
    <tr className="border-b border-gray-200 hover:bg-brand-50">
      {/* Nombre */}
      <td className="py-3 px-6 text-left">
        <div className="flex items-center">
          <span className="font-medium text-gray-900">{nombre}</span>
        </div>
      </td>

      {/* Duración */}
      <td className="py-3 px-6 text-center text-gray-700">
        {duracion_minutos} min
      </td>

      {/* Precio */}
      <td className="py-3 px-6 text-center text-gray-700">
        {Number.parseFloat(precio).toFixed(2)} €
      </td>

      {/* Estado */}
      <td className="py-3 px-6 text-center">
        <span
          className={`py-1 px-3 rounded-full text-xs font-semibold ${
            is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>

      {/* Acciones */}
      <td className="py-3 px-6 text-center">
        <div className="flex items-center justify-center space-x-2">
          {/* Editar (azul corporativo) */}
          <button
            onClick={() => onEdit(service)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 transition-colors"
            title="Editar servicio"
            aria-label="Editar servicio"
          >
            <PencilIcon className="w-5 h-5" />
          </button>

          {/* Eliminar (rojo) */}
          <button
            onClick={() => onDelete(id)}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            title="Eliminar servicio"
            aria-label="Eliminar servicio"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ServiceListItem;
