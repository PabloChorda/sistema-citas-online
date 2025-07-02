// frontend/src/services/establishmentService.js

import { apiClient } from './apiClient';

/**
 * Crea un nuevo establecimiento.
 * @param {object} establishmentData
 * @returns {Promise<any>}
 */
export const createEstablishment = (establishmentData) => {
  return apiClient('/establishments', 'POST', establishmentData);
};

/**
 * Obtiene los detalles de un establecimiento específico.
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const getEstablishmentById = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'GET');
};

/**
 * Actualiza un establecimiento existente.
 * @param {string|number} establishmentId
 * @param {object} establishmentData
 * @returns {Promise<any>}
 */
export const updateEstablishment = (establishmentId, establishmentData) => {
  return apiClient(`/establishments/${establishmentId}`, 'PUT', establishmentData);
};


/**
 * Elimina un establecimiento.
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const deleteEstablishment = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'DELETE');
};
