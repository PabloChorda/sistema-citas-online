// frontend/src/services/appointmentService.js

import { apiClient } from './apiClient';

/**
 * Crea una nueva cita. Requiere que el cliente esté autenticado.
 * @param {object} appointmentData - { service_id, start_time, notes_client?, staff_id? }
 * @returns {Promise<any>}
 */
export const createAppointment = (appointmentData) => {
  return apiClient('/appointments', 'POST', appointmentData);
};

/**
 * Obtiene el historial de citas del cliente autenticado. (Protegido para clientes)
 * @returns {Promise<any>} Un array con las citas.
 */
export const getClientAppointments = () => {
  return apiClient('/appointments/client', 'GET');
};

/**
 * Cancela una cita específica. (Protegido para clientes)
 * @param {number|string} appointmentId
 * @returns {Promise<any>}
 */
export const cancelAppointment = (appointmentId) => {
  return apiClient(`/appointments/${appointmentId}/cancel`, 'PUT');
};

/**
 * Reprograma una cita a una nueva fecha/hora. (Protegido)
 * @param {number|string} appointmentId
 * @param {string} newStartTime - ISO string (UTC)
 * @returns {Promise<any>}
 */
export const rescheduleAppointment = (appointmentId, newStartTime) => {
  return apiClient(`/appointments/${appointmentId}/reschedule`, 'PUT', { new_start_time: newStartTime });
};

/**
 * Obtiene la próxima cita confirmada del cliente autenticado.
 * @returns {Promise<object|null>}
 */
export const getNextClientAppointment = () => {
  return apiClient('/appointments/client/next', 'GET');
};

/* -------------------------------------------------------------------------- */
/*                          DESCARGA ICS DE UNA CITA                           */
/* -------------------------------------------------------------------------- */

/**
 * Intenta obtener la base URL de la API desde env o fallback.
 * Ajusta si en tu proyecto usas otra env var.
 */
function getBaseUrl() {
  return (
    import.meta.env?.VITE_API_BASE ||
    window.__API_BASE__ ||
    // fallback razonable si sirves el backend detrás del mismo host
    `${window.location.origin}/api`
  );
}

/**
 * Intenta obtener el token de acceso del storage.
 * ⚠️ Si tu app guarda el token en otra clave, ajústalo aquí.
 */
function getTokenFromStorage() {
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('token')
  );
}

/**
 * Descarga el .ics de una cita y dispara la descarga en el navegador.
 * Requiere estar autenticado como dueño de la cita (cliente) o proveedor dueño del establecimiento.
 *
 * @param {number|string} appointmentId
 * @param {object} opts
 * @param {string} [opts.baseUrl] - Base URL de la API (por defecto VITE_API_BASE)
 * @returns {Promise<void>}
 */
export async function downloadAppointmentIcs(
  appointmentId,
  { baseUrl = getBaseUrl() } = {}
) {
  if (!appointmentId) throw new Error('Falta appointmentId');

  // Si tu apiClient ya pone el token automáticamente en fetch,
  // podrías reusarlo; aquí lo sacamos del storage por simplicidad.
  const token = getTokenFromStorage();
  if (!token) throw new Error('No hay token. Inicia sesión para descargar el calendario.');

  const url = `${baseUrl}/appointments/${appointmentId}/ics`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/calendar,*/*',
    },
  });

  if (!res.ok) {
    // Intentamos leer un mensaje legible del backend
    let msg = `Error ${res.status}`;
    try {
      const text = await res.text();
      const maybe = JSON.parse(text);
      if (maybe?.msg) msg = maybe.msg;
    } catch {
      // ignorar parse error
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const filename = `appointment-${appointmentId}.ics`;

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
