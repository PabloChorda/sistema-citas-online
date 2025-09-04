// frontend/src/services/authService.js
import { apiClient } from './apiClient';
import { setAccessToken, setRefreshToken } from '../api/http';

const AUTH = '/auth';

export function loginUser(email, password) {
  return apiClient(`${AUTH}/login`, 'POST', { email, password });
}
export function registerUser(userData) {
  return apiClient(`${AUTH}/register/client`, 'POST', userData);
}
export function registerProvider(providerData) {
  return apiClient(`${AUTH}/register/provider`, 'POST', providerData);
}
export function validateAccount(token) {
  return apiClient(`${AUTH}/validate/${token}`, 'GET');
}
export function requestPasswordReset(email) {
  return apiClient(`${AUTH}/forgot-password`, 'POST', { email });
}
export function resetPasswordWithToken(token, password) {
  return apiClient(`${AUTH}/reset-password/${token}`, 'POST', { password });
}
export function loginWithGoogle(token) {
  return apiClient(`${AUTH}/oauth/google`, 'POST', { token });
}
export function initWhatsappMagicLink(phoneNumber) {
  return apiClient(`${AUTH}/whatsapp/init`, 'POST', { phone_number: phoneNumber });
}

export async function redeemMagicToken(token) {
  const res = await apiClient(`${AUTH}/magic?token=${encodeURIComponent(token)}`, 'GET');

  const { access_token, refresh_token, user_id, role, profile_complete } = res || {};

  try {
    if (access_token) setAccessToken(access_token);
    if (refresh_token) setRefreshToken(refresh_token);
    localStorage.setItem('authUser', JSON.stringify({ user_id, role }));
    localStorage.setItem('userRole', role || '');
  } catch (e) {
    console.debug('redeemMagicToken: storage not available', e);
  }

  return {
    user_id,
    role,
    access_token: access_token || null,
    refresh_token: refresh_token || null,
    profile_complete: !!profile_complete,
  };
}

export function resendEmailVerification() {
  return apiClient(`${AUTH}/email/resend-verification`, 'POST');
}

export function changePassword(current_password, new_password) {
  return apiClient('/auth/change-password', 'POST', { current_password, new_password });
}