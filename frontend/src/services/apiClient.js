// frontend/src/services/apiClient.js
const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

export async function apiClient(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('accessToken');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const res = await fetch(`${BASE_URL}${finalEndpoint}`, {
    method,
    headers,
    body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
  });

  // Algunas rutas pueden devolver 204 o no-JSON
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const msg = data?.msg || `HTTP ${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.response = { status: res.status, data };
    throw err;
  }
  return data;
}
