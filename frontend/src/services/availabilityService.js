// frontend/src/services/availabilityService.js

import { apiClient } from './apiClient';

export const getAvailability = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}/availability`, 'GET');
};

export const createAvailabilityRule = (establishmentId, ruleData) => {
  return apiClient(`/establishments/${establishmentId}/availability`, 'POST', ruleData);
};

export const updateAvailabilityRule = (ruleId, ruleData) => {
  return apiClient(`/availability/${ruleId}`, 'PUT', ruleData);
};

export const deleteAvailabilityRule = (ruleId) => {
  return apiClient(`/availability/${ruleId}`, 'DELETE');
};
