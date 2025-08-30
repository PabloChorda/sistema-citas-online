// frontend/src/services/clientService.js
import { apiClient } from './apiClient.js';

export function getClientProfile() {
  return apiClient('/client/profile', 'GET');
}

export function updateClientProfile(profileData) {
  return apiClient('/client/profile', 'PUT', profileData);
}
