// frontend/src/services/otpService.js
import { apiClient } from './apiClient';
import { setAccessToken, setRefreshToken } from '../api/http';

export async function requestPhoneOtp(phone_number) {
  return apiClient('/auth/phone/request-otp', 'POST', { phone_number });
}

export async function verifyPhoneOtp(phone_number, code) {
  // backend devuelve: { access_token, refresh_token, user_id, role, profile_complete }
  const res = await apiClient('/auth/phone/verify-otp', 'POST', { phone_number, code });

  const { access_token, refresh_token, user_id, role, profile_complete } = res || {};
  try {
    if (access_token) setAccessToken(access_token);
    if (refresh_token) setRefreshToken(refresh_token);
    localStorage.setItem('authUser', JSON.stringify({ user_id, role }));
    localStorage.setItem('userRole', role || '');
  } catch (_) {}

  return {
    access_token: access_token || null,
    refresh_token: refresh_token || null,
    user_id,
    role,
    profile_complete,
  };
}
