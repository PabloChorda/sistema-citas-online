// frontend/src/services/availabilityService.js

import { apiClient } from './apiClient';

/**
 * Obtiene todas las reglas de disponibilidad para un establecimiento.
 * @param {number} establishmentId
 * @returns {Promise<any>}
 */
export const getAvailability = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}/availability`, 'GET');
};

/**
 * Crea una nueva regla de disponibilidad.
 * @param {number} establishmentId
 * @param {object} ruleData - { dia_semana, hora_inicio, hora_fin }
 * @returns {Promise<any>}
 */
export const createAvailabilityRule = (establishmentId, ruleData) => {
  return apiClient(`/establishments/${establishmentId}/availability`, 'POST', ruleData);
};

/**
 * Actualiza una regla de disponibilidad.
 * @param {number} ruleId
 * @param {object} ruleData - Los campos a actualizar.
 * @returns {Promise<any>}
 */
export const updateAvailabilityRule = (ruleId, ruleData) => {
  return apiClient(`/availability/${ruleId}`, 'PUT', ruleData);
};

/**
 * Elimina una regla de disponibilidad.
 * @param {number} ruleId
 * @returns {Promise<any>}
 */
export const deleteAvailabilityRule = (ruleId) => {
  return apiClient(`/availability/${ruleId}`, 'DELETE');
};