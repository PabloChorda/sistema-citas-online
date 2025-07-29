// frontend/src/components/client/AppointmentCard.jsx

import React from 'react';

// Función para formatear fechas de una manera más amigable
const formatDate = (dateString) => {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

const AppointmentCard = ({ appointment, onCancel }) => {
  const { service, start_time, estado } = appointment;

  // Manejo de estado para el color del badge
  const statusStyles = {
    CONFIRMED: 'bg-green-100 text-green-800',
    PENDING_PROVIDER: 'bg-yellow-100 text-yellow-800',
    CANCELLED_BY_CLIENT: 'bg-red-100 text-red-800',
    CANCELLED_BY_PROVIDER: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    NO_SHOW: 'bg-gray-100 text-gray-800',
  };

  const isCancelable = estado === 'CONFIRMED' || estado === 'PENDING_PROVIDER';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{service?.nombre || 'Servicio no disponible'}</h3>
            <p className="text-sm text-gray-500 mt-1">en {service?.establishment?.nombre || 'Establecimiento no disponible'}</p>
          </div>
          <span className={`py-1 px-3 rounded-full text-xs font-semibold ${statusStyles[estado] || 'bg-gray-100'}`}>
            {estado.replace('_', ' ')}
          </span>
        </div>
        
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-md text-gray-700 font-semibold">{formatDate(start_time)}</p>
          <p className="text-sm text-gray-500">{service?.establishment?.direccion_completa || ''}</p>
        </div>
      </div>
      
      {isCancelable && (
        <div className="bg-gray-50 px-6 py-3 text-right">
          <button 
            onClick={() => onCancel(appointment.id)}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Cancelar Cita
          </button>
        </div>
      )}
    </div>
  );
};

export default AppointmentCard;