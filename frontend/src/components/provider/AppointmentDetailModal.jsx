// frontend/src/components/provider/AppointmentDetailModal.jsx

import React from 'react';
import Button from '../ui/Button'; // Usamos nuestro componente de botón reutilizable
import { XMarkIcon } from '@heroicons/react/24/solid';

const AppointmentDetailModal = ({ event, isOpen, onClose, onReschedule, onCancel }) => {
  // Si el modal no debe estar abierto o no tiene datos, no renderizamos nada.
  if (!isOpen || !event) {
    return null;
  }

  // Extraemos el objeto completo de la cita desde las 'extendedProps' del evento.
  const appointment = event.extendedProps.fullAppointment;
  
  // Si por alguna razón la cita no existe, evitamos un crash.
  if (!appointment) {
    return null; 
  }

  // Lógica para determinar si se pueden realizar acciones sobre la cita.
  const isActionable = appointment.estado === 'CONFIRMED' || appointment.estado === 'PENDING_PROVIDER';

  // Formateamos las horas para una visualización amigable.
  const startTime = event.start ? event.start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const endTime = event.end ? event.end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const date = event.start ? event.start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'N/A';

  return (
    // Fondo oscuro semi-transparente que cubre toda la pantalla
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      {/* Contenedor del modal */}
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative animate-fade-in-up">
        
        {/* Botón de cerrar en la esquina superior derecha */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          title="Cerrar ventana"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-4">Detalles de la Cita</h2>

        <div className="space-y-3 text-gray-700 border-t border-b border-gray-200 py-4">
          <p><strong>Servicio:</strong> {appointment.service?.nombre || 'No disponible'}</p>
          <p><strong>Cliente:</strong> {`${appointment.user?.first_name || ''} ${appointment.user?.last_name || ''}`} ({appointment.user?.email || 'N/A'})</p>
          <p><strong>Día:</strong> {date}</p>
          <p><strong>Hora:</strong> {startTime} - {endTime}</p>
          <p><strong>Estado:</strong> <span className="font-semibold">{appointment.estado}</span></p>
          {appointment.notas_cliente && <p><strong>Notas del Cliente:</strong> <em>"{appointment.notas_cliente}"</em></p>}
        </div>

        {/* Mostramos los botones de acción solo si la cita es 'actionable' */}
        {isActionable && (
          <div className="flex justify-end space-x-4 mt-6">
            <Button 
              variant="danger" 
              onClick={onCancel}
            >
              Cancelar Cita
            </Button>
            <Button 
              variant="primary"
              onClick={onReschedule}
            >
              Reprogramar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentDetailModal;