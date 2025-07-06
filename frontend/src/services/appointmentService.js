// frontend/src/services/appointmentService.js

import { apiClient } from './apiClient';

/**
 * Crea una nueva cita. Requiere que el cliente esté autenticado.
 * @param {object} appointmentData - { service_id, start_time, notes_client? }
 * @returns {Promise<any>}
 */
export const createAppointment = (appointmentData) => {
  return apiClient('appointments', 'POST', appointmentData);
};

// Aquí podríamos añadir en el futuro getClientAppointments, cancelAppointment, etc.
/**
* Obtiene el historial de citas del cliente autenticado. (Protegido para clientes)
* @returns {Promise<any>} Un array con los objetos de las citas.
*/
export const getClientAppointments = () => {
 return apiClient('/appointments/client', 'GET');
};

/**
* Cancela una cita específica. (Protegido para clientes)
* @param {number|string} appointmentId
* @returns {Promise<any>}
*/
export const cancelAppointment = (appointmentId) => {
 return apiClient(`/appointments/${appointmentId}/cancel`, 'PUT');
};