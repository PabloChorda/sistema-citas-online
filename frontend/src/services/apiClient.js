// frontend/src/services/apiClient.js
import { API_BASE, authFetch } from '../api/http';

/**
 * Cliente genérico para el backend.
 * - Usa authFetch (añade Authorization y reintenta con refresh_token si hay 401).
 * - Soporta body JSON automáticamente salvo en GET.
 * - Devuelve JSON si el servidor lo envía; si no, intenta texto. Para 204, null.
 */
export async function apiClient(endpoint, method = 'GET', body = null, extraHeaders = {}) {
  const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${finalEndpoint}`;

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...extraHeaders,
  });

  const init = {
    method,
    headers,
    credentials: 'include',
  };

  if (method.toUpperCase() !== 'GET' && body != null) {
    init.body = JSON.stringify(body);
  }

  const res = await authFetch(url, init);

  // 204 No Content
  if (res.status === 204) return null;

  const ctype = res.headers.get('content-type') || '';
  let data = null;

  if (ctype.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    // Si no es JSON, intenta devolver texto (útil para algunos endpoints simples)
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg =
      (data && (data.msg || data.error || data.detail)) ||
      `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.response = { status: res.status, data };
    throw err;
  }

  return data;
}
