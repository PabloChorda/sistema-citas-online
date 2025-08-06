// frontend/src/components/provider/AppointmentDetailModal.jsx

import React from 'react';
import ReactDOM from 'react-dom';
import Button from '../ui/Button';
import { XMarkIcon } from '@heroicons/react/24/solid';

const AppointmentDetailModal = ({ event, isOpen, onClose, onReschedule, onCancel }) => {
  if (!isOpen || !event) {
    return null;
  }

  const appointment = event.extendedProps.fullAppointment;
  
  if (!appointment) {
    console.error("Faltan datos de la cita en el evento del calendario.");
    onClose(); // Cerrar el modal si los datos están corruptos
    return null; 
  }

  const isActionable = appointment.estado === 'CONFIRMED' || appointment.estado === 'PENDING_PROVIDER';

  const startTime = event.start?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) || 'N/A';
  const endTime = event.end?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) || 'N/A';
  const date = event.start?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) || 'N/A';

  return ReactDOM.createPortal(
    (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative animate-fade-in-up">
          
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors" title="Cerrar ventana">
            <XMarkIcon className="h-6 w-6" />
          </button>

          <h2 className="text-2xl font-bold text-gray-800 mb-4">Detalles de la Cita</h2>
          
          <div className="space-y-3 text-gray-700 border-t border-b border-gray-200 py-4">
            <p><strong>Servicio:</strong> {appointment.service?.nombre || 'No disponible'}</p>
            <p><strong>Cliente:</strong> {`${appointment.user?.first_name || ''} ${appointment.user?.last_name || ''}`} ({appointment.user?.email || 'N/A'})</p>
            {/* --- CÓDIGO CLAVE: AÑADIMOS EL NOMBRE DEL PROFESIONAL --- */}
            {appointment.staff_member && (
                <p><strong>Profesional:</strong> {appointment.staff_member.first_name} {appointment.staff_member.last_name}</p>
            )}
            <p><strong>Día:</strong> {date}</p>
            <p><strong>Hora:</strong> {startTime} - {endTime}</p>
            <p><strong>Estado:</strong> <span className="font-semibold">{appointment.estado}</span></p>
            {appointment.notas_cliente && <p><strong>Notas del Cliente:</strong> <em>"{appointment.notas_cliente}"</em></p>}
          </div>

          {isActionable && (
            <div className="flex justify-end space-x-4 mt-6">
              <Button variant="danger" onClick={() => onCancel(appointment.id)}>
                Cancelar Cita
              </Button>
              <Button variant="primary" onClick={() => onReschedule(appointment)}>
                Reprogramar
              </Button>
            </div>
          )}
        </div>
      </div>
    ),
    document.getElementById('modal-portal')
  );
};

export default AppointmentDetailModal;