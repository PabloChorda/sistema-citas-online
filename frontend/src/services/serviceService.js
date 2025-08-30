// frontend/src/services/serviceService.js

import { apiClient } from './apiClient';

export const getServicesByEstablishment = (establishmentId) => {
  if (!establishmentId) return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  return apiClient(`/establishments/${establishmentId}/services`, 'GET');
};

export const createService = (establishmentId, serviceData) => {
  if (!establishmentId) return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  return apiClient(`/establishments/${establishmentId}/services`, 'POST', serviceData);
};

export const updateService = (serviceId, serviceData) => {
  if (!serviceId) return Promise.reject(new Error('El ID del servicio es requerido.'));
  return apiClient(`/services/${serviceId}`, 'PUT', serviceData);
};

export const deleteService = (serviceId) => {
  if (!serviceId) return Promise.reject(new Error('El ID del servicio es requerido.'));
  return apiClient(`/services/${serviceId}`, 'DELETE');
};
