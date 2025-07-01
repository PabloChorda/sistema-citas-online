// frontend/src/services/providerService.js
import { apiClient } from './apiClient.js';

/**
 * Obtiene el perfil del proveedor autenticado desde el backend.
 * @returns {Promise<object>} El objeto del perfil del proveedor.
 */
export function getProviderProfile() {
    return apiClient('/provider/profile', 'GET');
}

/**
 * Actualiza el perfil del proveedor autenticado.
 * @param {object} profileData - Un objeto con los campos del perfil a actualizar.
 * @returns {Promise<object>} El objeto del perfil del proveedor actualizado.
 */
export function updateProviderProfile(profileData) {
    return apiClient('/provider/profile', 'PUT', profileData);
}