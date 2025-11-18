// frontend/src/services/apiClient.js
import { apiGetJson, apiPostJson, apiPutJson, apiDelete } from '../api/http';

/**
 * apiClient(path, method, body, options)
 * - GET:    apiClient('/public/establishments', 'GET')
 * - POST:   apiClient('/auth/login', 'POST', {...})
 * - PUT:    apiClient('/establishments/1', 'PUT', {...})
 * - DELETE: apiClient('/establishments/1', 'DELETE')
 *
 * options: { params?: Record<string,string|number|boolean> }
 */
export function apiClient(path, method = 'GET', body = null, options = {}) {
  const params = options?.params || null;

  // Si hay params, añade ?query= al path (simple y suficiente)
  const withQs = params
    ? `${path}?${new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v === undefined || v === null) return acc;
          acc[k] = String(v);
          return acc;
        }, {})
      ).toString()}`
    : path;

  switch (String(method).toUpperCase()) {
    case 'GET':
      return apiGetJson(withQs);
    case 'POST':
      return apiPostJson(withQs, body);
    case 'PUT':
      return apiPutJson(withQs, body);
    case 'DELETE':
      return apiDelete(withQs);
    default:
      throw new Error(`apiClient: método no soportado: ${method}`);
  }
}
