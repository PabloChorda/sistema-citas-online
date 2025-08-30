// frontend/src/services/dashboardService.js

import { apiClient } from './apiClient';

export const getProviderDashboardSummary = () => {
  return apiClient('/provider/dashboard-summary', 'GET');
};
