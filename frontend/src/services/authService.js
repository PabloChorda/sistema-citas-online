// frontend/src/services/authService.js

// Importamos el apiClient centralizado.
// Toda la lógica de fetch, cabeceras y manejo de errores se delega a él.
import { apiClient } from './apiClient';

// El apiClient ya conoce la URL base, así que solo pasamos el endpoint específico.
const AUTH_ENDPOINT_PREFIX = '/auth';

// --- FUNCIONES DE AUTENTICACIÓN REFACTORIZADAS ---

/**
 * Inicia sesión de un usuario.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>}
 */
export function loginUser(email, password) {
  // Ya no necesitamos repetir method, headers, body, etc.
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/login`, 'POST', { email, password });
}

/**
 * Registra un nuevo usuario de tipo 'client'.
 * @param {object} userData 
 * @returns {Promise<object>}
 */
export function registerUser(userData) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/register/client`, 'POST', userData);
}

/**
 * Registra un nuevo usuario de tipo 'provider'.
 * @param {object} providerData 
 * @returns {Promise<object>}
 */
export function registerProvider(providerData) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/register/provider`, 'POST', providerData);
}

/**
 * Valida una cuenta a través de un token.
 * @param {string} token 
 * @returns {Promise<object>}
 */
export function validateAccount(token) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/validate/${token}`, 'GET');
}

/**
 * Solicita el restablecimiento de contraseña para un email.
 * @param {string} email 
 * @returns {Promise<object>}
 */
export function requestPasswordReset(email) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/forgot-password`, 'POST', { email });
}

/**
 * Restablece la contraseña usando un token.
 * @param {string} token 
 * @param {string} password 
 * @returns {Promise<object>}
 */
export function resetPasswordWithToken(token, password) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/reset-password/${token}`, 'POST', { password });
}

/**
 * Autentica a un usuario usando un token de Google.
 * @param {string} token - El credential token de Google.
 * @returns {Promise<object>}
 */
export function loginWithGoogle(token) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/oauth/google`, 'POST', { token });
}