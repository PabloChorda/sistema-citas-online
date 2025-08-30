// frontend/src/services/otpService.js
import { apiClient } from './apiClient';

export async function requestPhoneOtp(phone_number) {
  return apiClient('/auth/phone/request-otp', 'POST', { phone_number });
}

export async function verifyPhoneOtp(phone_number, code) {
  const res = await apiClient('/auth/phone/verify-otp', 'POST', { phone_number, code });

  const { access_token, user_id, role, profile_complete } = res || {};
  if (access_token) {
    try {
      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('authUser', JSON.stringify({ user_id, role }));
      localStorage.setItem('userRole', role);
    } catch (e) {
      console.debug('verifyPhoneOtp: storage not available', e);
    }
  }
  return { access_token, user_id, role, profile_complete };
}
