// frontend/src/services/staffService.js

import { apiClient } from './apiClient';

export const getStaffForEstablishment = (establishmentId) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  return apiClient(`/establishments/${establishmentId}/staff`, 'GET');
};

export const addStaffMember = (establishmentId, staffData) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  return apiClient(`/establishments/${establishmentId}/staff`, 'POST', staffData);
};

export const updateStaffMember = (staffId, staffData) => {
  if (!staffId) return Promise.reject(new Error("El ID del staff es requerido."));
  return apiClient(`/staff/${staffId}`, 'PUT', staffData);
};

export const deleteStaffMember = (staffId) => {
  if (!staffId) return Promise.reject(new Error("El ID del staff es requerido."));
  return apiClient(`/staff/${staffId}`, 'DELETE');
};

// Disponibilidad del staff
export const getStaffAvailability = (staffId) => {
  return apiClient(`/staff/${staffId}/availability`, 'GET');
};

export const createStaffAvailabilityRule = (staffId, ruleData) => {
  return apiClient(`/staff/${staffId}/availability`, 'POST', ruleData);
};

export const updateStaffAvailabilityRule = (ruleId, ruleData) => {
  return apiClient(`/staff-availability/${ruleId}`, 'PUT', ruleData);
};

export const deleteStaffAvailabilityRule = (ruleId) => {
  return apiClient(`/staff-availability/${ruleId}`, 'DELETE');
};

// Público (BookingPage)
export const getPublicStaffForEstablishment = (establishmentId) => {
  if (!establishmentId) return Promise.reject(new Error("El ID del establecimiento es requerido."));
  return apiClient(`/public/establishments/${establishmentId}/staff`, 'GET');
};
