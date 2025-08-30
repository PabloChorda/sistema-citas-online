// frontend/src/services/establishmentService.js

import { apiClient } from './apiClient';

export const createEstablishment = (establishmentData) => {
  return apiClient('/establishments', 'POST', establishmentData);
};

export const getEstablishmentById = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'GET');
};

export const updateEstablishment = (establishmentId, establishmentData) => {
  return apiClient(`/establishments/${establishmentId}`, 'PUT', establishmentData);
};

export const deleteEstablishment = (establishmentId) => {
  return apiClient(`/establishments/${establishmentId}`, 'DELETE');
};

export const getPublicEstablishmentDetails = (establishmentId) => {
  return apiClient(`/public/establishments/${establishmentId}`, 'GET');
};

export const getAvailableSlots = (establishmentId, serviceId, date, staffId = null) => {
  if (!establishmentId || !serviceId || !date) {
    return Promise.reject(new Error('Faltan parámetros para obtener los horarios.'));
  }
  // usando params del apiClient (si tu apiClient aún no soporta params, deja la versión con query string)
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

export const getAllPublicEstablishments = () => {
  return apiClient('/public/establishments', 'GET');
};

export const getAppointmentsForEstablishment = (establishmentId, startDate, endDate) => {
  if (!establishmentId || !startDate || !endDate) {
    return Promise.reject(new Error('Faltan parámetros para obtener la agenda.'));
  }
  return apiClient(
    `/establishments/${establishmentId}/appointments`,
    'GET',
    null,
    { params: { start: startDate, end: endDate } }
  );
};
