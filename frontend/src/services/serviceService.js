// frontend/src/services/serviceService.js

// La importación es con nombre, igual que en tus otros archivos. Correcto.
import { apiClient } from './apiClient';

/**
 * Obtiene todos los servicios para un establecimiento específico.
 * @param {number} establishmentId - El ID del establecimiento.
 * @returns {Promise<any>}
 */
export const getServicesByEstablishment = (establishmentId) => {
  if (!establishmentId) {
    return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  }
  // Llamamos a la función apiClient con el endpoint y el método. Correcto.
  return apiClient(`/establishments/${establishmentId}/services`, 'GET');
};

/**
 * Crea un nuevo servicio para un establecimiento.
 * @param {number} establishmentId - El ID del establecimiento.
 * @param {object} serviceData - Los datos del nuevo servicio.
 * @returns {Promise<any>}
 */
export const createService = (establishmentId, serviceData) => {
  if (!establishmentId) {
    return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  }
  // Llamamos con el método POST y el cuerpo de la petición. Correcto.
  return apiClient(`/establishments/${establishmentId}/services`, 'POST', serviceData);
};

/**
 * Actualiza un servicio existente.
 * @param {number} serviceId - El ID del servicio a actualizar.
 * @param {object} serviceData - Los datos actualizados del servicio.
 * @returns {Promise<any>}
 */
export const updateService = (serviceId, serviceData) => {
  if (!serviceId) {
    return Promise.reject(new Error('El ID del servicio es requerido.'));
  }
  return apiClient(`/services/${serviceId}`, 'PUT', serviceData);
};

/**
 * Elimina un servicio.
 * @param {number} serviceId - El ID del servicio a eliminar.
 * @returns {Promise<any>}
 */
export const deleteService = (serviceId) => {
  if (!serviceId) {
    return Promise.reject(new Error('El ID del servicio es requerido.'));
  }
  return apiClient(`/services/${serviceId}`, 'DELETE');
};
