// frontend/src/services/establishmentService.js

import { apiClient } from './apiClient';

/**
 * Crea un nuevo establecimiento. (Protegido)
 * @param {object} establishmentData
 * @returns {Promise<any>}
 */
export const createEstablishment = (establishmentData) => {
  return apiClient('/establishments', 'POST', establishmentData);
};

/**
 * Obtiene los detalles de un establecimiento específico (versión para el proveedor). (Protegido)
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const getEstablishmentById = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'GET');
};

/**
 * Actualiza un establecimiento existente. (Protegido)
 * @param {string|number} establishmentId
 * @param {object} establishmentData
 * @returns {Promise<any>}
 */
export const updateEstablishment = (establishmentId, establishmentData) => {
  return apiClient(`/establishments/${establishmentId}`, 'PUT', establishmentData);
};

/**
 * Elimina un establecimiento. (Protegido)
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const deleteEstablishment = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'DELETE');
};

/**
 * Obtiene los detalles públicos de un establecimiento para la página de reserva. (Público)
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const getPublicEstablishmentDetails = (establishmentId) => {
  return apiClient(`/public/establishments/${establishmentId}`, 'GET');
};

/**
 * Obtiene los huecos de tiempo disponibles para un servicio en una fecha específica. (Público)
 * @param {number|string} establishmentId
 * @param {number|string} serviceId
 * @param {string} date - Fecha en formato 'YYYY-MM-DD'
 * @returns {Promise<string[]>}
 */
export const getAvailableSlots = (establishmentId, serviceId, date) => {
  if (!establishmentId || !serviceId || !date) {
    return Promise.reject(new Error('Faltan parámetros para obtener los horarios.'));
  }
  const endpoint = `/establishments/${establishmentId}/available-slots?service_id=${serviceId}&date=${date}`;
  return apiClient(endpoint, 'GET');
};

/**
 * Obtiene la lista de todos los establecimientos públicos para el directorio. (Público)
 * @returns {Promise<any>} Una lista de objetos de establecimiento.
 */
export const getAllPublicEstablishments = () => {
  // Apunta a la nueva ruta pública que acabamos de crear en el backend.
  return apiClient('/public/establishments', 'GET');
};
/**
 * Obtiene todas las citas para un establecimiento en un rango de fechas.
 * @param {string|number} establishmentId
 * @param {string} startDate - Fecha de inicio en formato 'YYYY-MM-DD'
 * @param {string} endDate - Fecha de fin en formato 'YYYY-MM-DD'
 * @returns {Promise<any>}
 */
export const getAppointmentsForEstablishment = (establishmentId, startDate, endDate) => {
  if (!establishmentId || !startDate || !endDate) {
    return Promise.reject(new Error("Faltan parámetros para obtener la agenda."));
  }
  
  const endpoint = `/establishments/${establishmentId}/appointments?start=${startDate}&end=${endDate}`;
  return apiClient(endpoint, 'GET');
};