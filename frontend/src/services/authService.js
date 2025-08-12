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

/**
 * Genera una URL mágica de WhatsApp para un teléfono (requiere sesión de provider/staff/admin).
 * @param {string} phoneNumber - Número en formato E.164 (p. ej. +34600111222)
 * @returns {Promise<{url: string, user_id: number}>}
 */
export function initWhatsappMagicLink(phoneNumber) {
  return apiClient(`${AUTH_ENDPOINT_PREFIX}/whatsapp/init`, 'POST', {
    phone_number: phoneNumber,
  });
}

/**
 * Canjea un token mágico y crea sesión local.
 * Guarda accessToken en localStorage y devuelve user básico.
 * @param {string} token
 * @returns {Promise<{ user_id: number, role: string, access_token: string }>}
 */
export async function redeemMagicToken(token) {
  // En tu apiClient, los params de GET van en la URL
  const res = await apiClient(
    `${AUTH_ENDPOINT_PREFIX}/magic?token=${encodeURIComponent(token)}`,
    'GET'
  );

  const { access_token, user_id, role } = res || {};
  if (access_token) {
    try {
      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('authUser', JSON.stringify({ user_id, role }));
    } catch (_) {
      // evitar romper si storage no está disponible
    }
  }

  return { user_id, role, access_token };
}
