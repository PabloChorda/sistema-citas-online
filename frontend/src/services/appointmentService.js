// frontend/src/services/appointmentService.js

import { apiClient } from './apiClient';

/**
 * Crea una nueva cita. Requiere que el cliente esté autenticado.
 * @param {object} appointmentData - { service_id, start_time, notes_client? }
 * @returns {Promise<any>}
 */
export const createAppointment = (appointmentData) => {
  return apiClient('/appointments', 'POST', appointmentData);
};

/**
 * Obtiene el historial de citas del cliente autenticado. (Protegido para clientes)
 * @returns {Promise<any>} Un array con las citas.
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

/**
 * Reprograma una cita a una nueva fecha/hora. (Protegido)
 * @param {number|string} appointmentId
 * @param {string} newStartTime - ISO string (UTC)
 * @returns {Promise<any>}
 */
export const rescheduleAppointment = (appointmentId, newStartTime) => {
  return apiClient(`/appointments/${appointmentId}/reschedule`, 'PUT', { new_start_time: newStartTime });
};

/**
 * Obtiene la próxima cita confirmada del cliente autenticado.
 * @returns {Promise<object|null>}
 */
export const getNextClientAppointment = () => {
  return apiClient('/appointments/client/next', 'GET');
};
