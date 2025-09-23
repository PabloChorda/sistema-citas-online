// frontend/src/services/calendarService.js
import { apiClient } from './apiClient';

/**
 * Devuelve blackouts de calendario para un establecimiento en un rango.
 * @param {{ establishmentId:number|string, from?:string, to?:string }} p
 * - from/to en formato "YYYY-MM-DD"
 */
export const getBlackouts = ({ establishmentId, from, to }) => {
  const params = {
    establishment_id: String(establishmentId),
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
  };
  return apiClient('/calendar/blackouts', 'GET', null, { params });
};

/**
 * (Opcional) Festivos desde Nager.Date (proxy backend).
 * @param {{ country?:string, region?:string, from?:string, to?:string, year?:number, types?:string }} p
 * - country por defecto 'ES'
 * - region ejemplo 'ES-VC' (código Nager de la comunidad)
 * - from/to en "YYYY-MM-DD"
 * - types ej: "Public,Bank"
 */
export const getHolidays = ({ country = 'ES', region, from, to, year, types } = {}) => {
  const params = {
    country,
    ...(region ? { region } : {}),
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
    ...(year ? { year: String(year) } : {}),
    ...(types ? { types } : {}),
  };
  return apiClient('/calendar/holidays', 'GET', null, { params });
};

/**
 * Crear blackout (requiere sesión de provider)
 * - Si isFullDay=true, NO envía start_time/end_time
 * - Si isFullDay=false, startTime y endTime son obligatorios ("HH:MM")
 */
export const createBlackout = ({
  establishmentId,
  date,                // "YYYY-MM-DD"
  isFullDay = true,
  startTime,           // "HH:MM" (si isFullDay=false)
  endTime,             // "HH:MM" (si isFullDay=false)
  name,
  category,
}) => {
  const payload = {
    establishment_id: Number(establishmentId),
    date,
    is_full_day: !!isFullDay,
    ...(isFullDay ? {} : { start_time: startTime, end_time: endTime }),
    ...(name ? { name } : {}),
    ...(category ? { category } : {}),
  };
  return apiClient('/calendar/blackouts', 'POST', payload);
};

/**
 * Actualizar blackout (placeholder)
 * ⚠️ OJO: El backend aún no expone PUT /calendar/blackouts/:id.
 * Si lo implementas después, esta función quedará lista.
 */
export const updateBlackout = (blackoutId, payload) =>
  apiClient(`/calendar/blackouts/${blackoutId}`, 'PUT', payload);

/**
 * Eliminar blackout (requiere sesión de provider y ser dueño del establecimiento)
 */
export const deleteBlackout = (blackoutId) =>
  apiClient(`/calendar/blackouts/${blackoutId}`, 'DELETE');

/**
 * Sembrar festivos como blackouts de día completo (idempotente en backend)
 */
export const seedHolidays = ({
  establishmentId,
  country = 'ES',
  year,
  region,
  category = 'holiday',
  types = 'Public,Bank',
}) => {
  return apiClient('/calendar/blackouts/seed-holidays', 'POST', {
    establishment_id: Number(establishmentId),
    country,
    year,
    region,
    category,
    types,
  });
};
