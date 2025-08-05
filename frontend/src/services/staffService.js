// frontend/src/services/staffService.js

import { apiClient } from './apiClient';

/**
 * Obtiene la lista de miembros del staff para un establecimiento.
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const getStaffForEstablishment = (establishmentId) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  return apiClient(`/establishments/${establishmentId}/staff`, 'GET');
};

/**
 * Añade un nuevo miembro del staff a un establecimiento.
 * @param {string|number} establishmentId
 * @param {object} staffData
 * @returns {Promise<any>}
 */
export const addStaffMember = (establishmentId, staffData) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  return apiClient(`/establishments/${establishmentId}/staff`, 'POST', staffData);
};

/**
 * Actualiza los datos de un miembro del staff.
 * @param {string|number} staffId
 * @param {object} staffData
 * @returns {Promise<any>}
 */
export const updateStaffMember = (staffId, staffData) => {
  if (!staffId) return Promise.reject(new Error("El ID del staff es requerido."));
  return apiClient(`/staff/${staffId}`, 'PUT', staffData);
};

/**
 * Elimina un miembro del staff.
 * @param {string|number} staffId
 * @returns {Promise<any>}
 */
export const deleteStaffMember = (staffId) => {
  if (!staffId) return Promise.reject(new Error("El ID del staff es requerido."));
  return apiClient(`/staff/${staffId}`, 'DELETE');
};

// --- NUEVAS FUNCIONES PARA LA DISPONIBILIDAD DEL STAFF ---

/**
 * Obtiene las reglas de disponibilidad para un miembro del staff.
 * @param {string|number} staffId
 * @returns {Promise<any>}
 */
export const getStaffAvailability = (staffId) => {
  return apiClient(`/staff/${staffId}/availability`, 'GET');
};

/**
 * Crea una nueva regla de disponibilidad para un miembro del staff.
 * @param {string|number} staffId
 * @param {object} ruleData
 * @returns {Promise<any>}
 */
export const createStaffAvailabilityRule = (staffId, ruleData) => {
  return apiClient(`/staff/${staffId}/availability`, 'POST', ruleData);
};

/**
 * Actualiza una regla de disponibilidad de un miembro del staff.
 * @param {string|number} ruleId
 * @param {object} ruleData
 * @returns {Promise<any>}
 */
export const updateStaffAvailabilityRule = (ruleId, ruleData) => {
  return apiClient(`/staff-availability/${ruleId}`, 'PUT', ruleData);
};

/**
 * Elimina una regla de disponibilidad de un miembro del staff.
 * @param {string|number} ruleId
 * @returns {Promise<any>}
 */
export const deleteStaffAvailabilityRule = (ruleId) => {
  return apiClient(`/staff-availability/${ruleId}`, 'DELETE');
};

/**
 * Obtiene la lista PÚBLICA de miembros del staff para la BookingPage.
 * @param {string|number} establishmentId
 * @returns {Promise<any>}
 */
export const getPublicStaffForEstablishment = (establishmentId) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  // Apuntamos a la nueva ruta pública
  return apiClient(`/public/establishments/${establishmentId}/staff`, 'GET');
};