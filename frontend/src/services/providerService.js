// frontend/src/services/providerService.js
import { apiClient } from './apiClient.js';

export function getProviderProfile() {
  return apiClient('/provider/profile', 'GET');
}

export function updateProviderProfile(profileData) {
  return apiClient('/provider/profile', 'PUT', profileData);
}
