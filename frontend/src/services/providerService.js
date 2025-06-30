// src/services/providerService.js

// Importamos nuestro nuevo cliente API
import { apiClient } from './apiClient.js';

/**
 * Obtiene el perfil del proveedor autenticado.
 */
export function getProviderProfile() {
    // La lógica del token ahora está dentro de apiClient.
    return apiClient('/provider/profile', 'GET');
}

/**
 * Actualiza el perfil del proveedor autenticado.
 * @param {object} profileData - Los datos del perfil a actualizar.
 */
export function updateProviderProfile(profileData) {
    // Solo le pasamos el endpoint, el método y los datos.
    return apiClient('/provider/profile', 'PUT', profileData);
}