// src/services/clientService.js

import { apiClient } from './apiClient.js';

/**
 * Obtiene el perfil del cliente autenticado.
 */
export function getClientProfile() {
    return apiClient('/client/profile', 'GET');
}

/**
 * Actualiza el perfil del cliente autenticado.
 * @param {object} profileData - Los datos del perfil a actualizar.
 */
export function updateClientProfile(profileData) {
    return apiClient('/client/profile', 'PUT', profileData);
}