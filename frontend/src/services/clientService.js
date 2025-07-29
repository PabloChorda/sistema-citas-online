// frontend/src/services/clientService.js
import { apiClient } from './apiClient.js';

/**
 * Obtiene el perfil del cliente autenticado desde el backend.
 * @returns {Promise<object>} El objeto del perfil del cliente (modelo User).
 */
export function getClientProfile() {
    return apiClient('/client/profile', 'GET');
}

/**
 * Actualiza el perfil del cliente autenticado.
 * @param {object} profileData - Un objeto con los campos a actualizar (first_name, last_name, etc.).
 * @returns {Promise<object>} El objeto del perfil del cliente actualizado.
 */
export function updateClientProfile(profileData) {
    return apiClient('/client/profile', 'PUT', profileData);
}