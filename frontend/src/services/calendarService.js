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
 * (Opcional) Festivos automáticos si implementas /api/calendar/holidays en backend.
 * @param {{ country?:string, region?:string, from?:string, to?:string, year?:number }} p
 * - country por defecto 'ES'
 * - region ejemplo 'VC' (Comunitat Valenciana)
 * - from/to en "YYYY-MM-DD"
 */
export const getHolidays = ({ country = 'ES', region, from, to, year } = {}) => {
  const params = {
    country,
    ...(region ? { region } : {}),
    ...(from ? { date_from: from } : {}),
    ...(to ? { date_to: to } : {}),
    ...(year ? { year: String(year) } : {}),
  };
  return apiClient('/calendar/holidays', 'GET', null, { params });
};
