// frontend/src/services/staffService.js

import { apiClient } from './apiClient';

/**
 * Obtiene el staff de un establecimiento.
 * @param {number|string} establishmentId
 * @param {{ includeInactive?: boolean }} [options]
 *  - includeInactive: si el backend lo soporta, incluye personal inactivo (p.ej. ?include_inactive=1)
 */
export const getStaffForEstablishment = (establishmentId, options = {}) => {
  if (!establishmentId) {
    return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  }

  let qs = '';
  if (options && options.includeInactive) {
    qs = '?include_inactive=1';
  }

  // Evitamos pasar un 4º argumento a apiClient; metemos la query en la URL
  return apiClient(`/establishments/${establishmentId}/staff${qs}`, 'GET');
};

/**
 * Utilidad opcional: normaliza una lista de staff a [{ id, name }]
 * para protegerte de variaciones del backend (first_name/last_name vs nombre/apellidos, etc.)
 */
export const normalizeStaffList = (list) =>
  (Array.isArray(list) ? list : [])
    .map((s) => {
      // id
      let id = (s && s.id !== undefined && s.id !== null) ? s.id
        : (s && s.staff_id !== undefined && s.staff_id !== null) ? s.staff_id
        : (s && s.user_id !== undefined && s.user_id !== null) ? s.user_id
        : (s && s.staffId !== undefined && s.staffId !== null) ? s.staffId
        : null;

      // nombres
      const first =
        (s && (s.first_name || s.nombre || s.firstName)) || '';
      const last =
        (s && (s.last_name || s.apellidos || s.lastName)) || '';

      const composed = `${first} ${last}`.trim();

      const fallbackName =
        (s && (s.name || s.display_name || s.displayName)) || (composed || 'Empleado');

      if (id === null || id === undefined) return null;

      return { id: String(id), name: composed || fallbackName };
    })
    .filter(Boolean);

export const addStaffMember = (establishmentId, staffData) => {
  if (!establishmentId) {
    return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  }
  return apiClient(`/establishments/${establishmentId}/staff`, 'POST', staffData);
};

export const updateStaffMember = (staffId, staffData) => {
  if (!staffId) {
    return Promise.reject(new Error('El ID del staff es requerido.'));
  }
  return apiClient(`/staff/${staffId}`, 'PUT', staffData);
};

export const deleteStaffMember = (staffId) => {
  if (!staffId) {
    return Promise.reject(new Error('El ID del staff es requerido.'));
  }
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
  if (!establishmentId) {
    return Promise.reject(new Error('El ID del establecimiento es requerido.'));
  }
  return apiClient(`/public/establishments/${establishmentId}/staff`, 'GET');
};
