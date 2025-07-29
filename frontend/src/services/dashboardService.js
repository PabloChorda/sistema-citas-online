// frontend/src/services/dashboardService.js

import { apiClient } from './apiClient';

/**
 * Obtiene los datos de resumen para el dashboard del proveedor.
 * @returns {Promise<any>}
 */
export const getProviderDashboardSummary = () => {
  return apiClient('/provider/dashboard-summary', 'GET');
};
