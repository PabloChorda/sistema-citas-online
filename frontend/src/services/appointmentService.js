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