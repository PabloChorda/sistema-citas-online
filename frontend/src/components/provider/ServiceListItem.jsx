//frontend/src/components/provider/ServiceListItem.jsx

import React from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline'; // Iconos para los botones

const ServiceListItem = ({ service, onEdit, onDelete }) => {
  const { id, nombre, duracion_minutos, precio, is_active } = service;

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50">
      <td className="py-3 px-6 text-left">
        <div className="flex items-center">
          <span className="font-medium">{nombre}</span>
        </div>
      </td>
      <td className="py-3 px-6 text-center">{duracion_minutos} min</td>
      <td className="py-3 px-6 text-center">{parseFloat(precio).toFixed(2)} €</td>
      <td className="py-3 px-6 text-center">
        <span className={`py-1 px-3 rounded-full text-xs ${is_active ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          {is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="py-3 px-6 text-center">
        <div className="flex item-center justify-center space-x-4">
          <button 
            onClick={() => onEdit(service)} 
            className="w-6 h-6 text-purple-600 hover:text-purple-900"
            title="Editar servicio"
          >
            <PencilIcon />
          </button>
          <button 
            onClick={() => onDelete(id)} 
            className="w-6 h-6 text-red-600 hover:text-red-900"
            title="Eliminar servicio"
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ServiceListItem;