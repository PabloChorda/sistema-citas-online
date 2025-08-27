// frontend/src/services/authService.js

// Unificado para usar el cliente HTTP centralizado (con refresh silencioso)
import { apiClient, setAccessToken, setRefreshToken } from '../api/http';

const AUTH = '/auth';

// --- FUNCIONES DE AUTENTICACIÓN ---

/**
 * Inicia sesión de un usuario.
 * Backend devuelve: { access_token, refresh_token, role, user_id, ... }
 */
export function loginUser(email, password) {
  return apiClient(`${AUTH}/login`, 'POST', { email, password });
}

/**
 * Registra un nuevo 'client'.
 */
export function registerUser(userData) {
  return apiClient(`${AUTH}/register/client`, 'POST', userData);
}

/**
 * Registra un nuevo 'provider'.
 */
export function registerProvider(providerData) {
  return apiClient(`${AUTH}/register/provider`, 'POST', providerData);
}

/**
 * Valida cuenta por token.
 */
export function validateAccount(token) {
  return apiClient(`${AUTH}/validate/${token}`, 'GET');
}

/**
 * Solicita inicio de flujo de reset por email.
 * ⚠️ Asegúrate de tener este endpoint en backend. Si no existe, ajusta la ruta.
 */
export function requestPasswordReset(email) {
  return apiClient(`${AUTH}/forgot-password`, 'POST', { email });
}

/**
 * Establece nueva contraseña con token.
 */
export function resetPasswordWithToken(token, password) {
  return apiClient(`${AUTH}/reset-password/${token}`, 'POST', { password });
}

/**
 * Login con Google (credential token de Google).
 * Backend debe devolver también refresh_token (ya lo tienes).
 */
export function loginWithGoogle(token) {
  return apiClient(`${AUTH}/oauth/google`, 'POST', { token });
}

/**
 * Genera enlace/QR universal de WhatsApp (requiere sesión proveedor/staff/admin).
 */
export function initWhatsappMagicLink(phoneNumber) {
  return apiClient(`${AUTH}/whatsapp/init`, 'POST', {
    phone_number: phoneNumber,
  });
}

/**
 * Canjea token mágico y crea sesión local.
 * Si el backend empieza a devolver refresh_token aquí también,
 * lo persistimos de igual forma (queda listo).
 */
export async function redeemMagicToken(token) {
  const res = await apiClient(
    `${AUTH}/magic?token=${encodeURIComponent(token)}`,
    'GET'
  );

  const { access_token, refresh_token, user_id, role, profile_complete } = res || {};

  // Persistencia (compat con keys antiguas)
  try {
    if (access_token) setAccessToken(access_token);
    if (refresh_token) setRefreshToken(refresh_token);

    localStorage.setItem('authUser', JSON.stringify({ user_id, role }));
    localStorage.setItem('userRole', role || '');
  } catch {
    // Ignorar errores de storage (modo incógnito, etc.)
  }

  return {
    user_id,
    role,
    access_token: access_token || null,
    refresh_token: refresh_token || null,
    profile_complete: !!profile_complete,
  };
}

/**
 * Reenvía email de verificación.
 */
export function resendEmailVerification() {
  return apiClient(`${AUTH}/email/resend-verification`, 'POST');
}
