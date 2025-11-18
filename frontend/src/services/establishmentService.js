// frontend/src/services/establishmentService.js

import { apiClient } from './apiClient';
import { API_BASE } from '../api/http';

/**
 * Crear establecimiento (panel proveedor)
 */
export const createEstablishment = (establishmentData) => {
  return apiClient('/establishments', 'POST', establishmentData);
};

/**
 * GET privado de un establecimiento por ID (panel proveedor)
 * Alias: getEstablishmentPrivate
 */
export const getEstablishmentById = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'GET');
};
export const getEstablishmentPrivate = getEstablishmentById;

/**
 * PUT privado para actualizar un establecimiento (panel proveedor)
 * Alias: updateEstablishmentPrivate
 */
export const updateEstablishment = (establishmentId, establishmentData) => {
  return apiClient(`/establishments/${establishmentId}`, 'PUT', establishmentData);
};
export const updateEstablishmentPrivate = updateEstablishment;

/**
 * Helper específico para actualizar SOLO ajustes de festivos automáticos.
 * Evita enviar campos no relacionados.
 */
export const updateHolidaySettings = (
  establishmentId,
  {
    holiday_auto_enabled,
    holiday_country_code,
    holiday_region_code,
    holiday_types,
    holiday_years_ahead,
  }
) => {
  const payload = {
    ...(typeof holiday_auto_enabled === 'boolean' ? { holiday_auto_enabled } : {}),
    ...(holiday_country_code ? { holiday_country_code } : {}),
    // Si la región viene vacía queremos enviar null para limpiarla:
    ...(holiday_region_code !== undefined ? { holiday_region_code: holiday_region_code || null } : {}),
    ...(holiday_types ? { holiday_types } : {}),
    ...(Number.isFinite(holiday_years_ahead) ? { holiday_years_ahead: Number(holiday_years_ahead) } : {}),
  };
  return updateEstablishment(establishmentId, payload);
};

/**
 * DELETE privado de establecimiento
 */
export const deleteEstablishment = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'DELETE');
};

/**
 * GET público de detalles para la página de reserva
 */
export const getPublicEstablishmentDetails = (establishmentId) => {
  return apiClient(`/public/establishments/${establishmentId}`, 'GET');
};

/**
 * Horarios disponibles (público). Soporta staff opcional.
 */
export const getAvailableSlots = (establishmentId, serviceId, date, staffId = null) => {
  if (!establishmentId || !serviceId || !date) {
    return Promise.reject(new Error('Faltan parámetros para obtener los horarios.'));
  }
  return apiClient(
    `/establishments/${establishmentId}/available-slots`,
    'GET',
    null,
    {
      params: {
        service_id: serviceId,
        date,
        ...(staffId && staffId !== 'any' ? { staff_id: staffId } : {}),
      },
    }
  );
};

/**
 * Listado público (marketplace/directorio)
 * FORZAMOS llamada sin Authorization para evitar refresh/token
 * y seguimos normalizando a array.
 */
export const getAllPublicEstablishments = async () => {
  const res = await fetch(`${API_BASE}/public/establishments`, {
    method: 'GET',
    credentials: 'include',
    // 👇 nada de Authorization aquí, así no entra en el flujo de refresh
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignoramos error al leer el cuerpo
    }
    throw new Error(
      `GET /public/establishments ${res.status}: ${detail || res.statusText}`
    );
  }

  const data = await res.json();

  // Normalización que ya tenías antes:
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;

  return [];
};

/**
 * Citas de un establecimiento (panel proveedor)
 * Ahora acepta staffId opcional para filtrar en servidor.
 */
export const getAppointmentsForEstablishment = (establishmentId, startDate, endDate, staffId) => {
  if (!establishmentId || !startDate || !endDate) {
    return Promise.reject(new Error('Faltan parámetros para obtener la agenda.'));
  }

  const params = { start: startDate, end: endDate };
  if (staffId && staffId !== 'all') {
    params.staff_id = staffId;
  }

  return apiClient(
    `/establishments/${establishmentId}/appointments`,
    'GET',
    null,
    { params }
  );
};
