// frontend/src/services/apiClient.js
import { API_BASE, authFetch } from '../api/http';

/**
 * Convierte un objeto de params en querystring.
 * Soporta arrays: { a:[1,2] } -> ?a=1&a=2
 */
function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      v.forEach(item => {
        if (item != null) usp.append(k, String(item));
      });
    } else {
      usp.append(k, String(v));
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Normaliza el 4º argumento:
 * - Si pasas un simple objeto de headers (legacy), lo trata como headers.
 * - Si pasas { params, headers } usa ambos.
 */
function normalizeOptions(extra) {
  if (!extra) return { params: null, headers: {} };
  // Si parece options shape nueva
  if (typeof extra === 'object' && ('params' in extra || 'headers' in extra)) {
    return {
      params: extra.params || null,
      headers: extra.headers || {},
    };
  }
  // Compatibilidad: extra = headers
  return { params: null, headers: extra || {} };
}

/**
 * Cliente genérico para el backend.
 * - Usa authFetch (añade Authorization y reintenta con refresh_token si hay 401).
 * - Soporta body JSON automáticamente salvo en GET.
 * - Soporta params de query vía 4º argumento: apiClient('/path', 'GET', null, { params:{...} })
 * - Devuelve JSON si el servidor lo envía; si no, intenta texto. Para 204, null.
 *
 * @param {string} endpoint - Ruta relativa (con o sin '/')
 * @param {string} method   - 'GET' | 'POST' | 'PUT' | 'DELETE' ...
 * @param {any}    body     - objeto JSON o FormData (si FormData, no se fuerza Content-Type)
 * @param {object} extra    - (opcional) { params?: Record<string,any>, headers?: Record<string,string> }
 *                            // Compat: también puede ser directamente un objeto headers
 */
export async function apiClient(endpoint, method = 'GET', body = null, extra = undefined) {
  const { params, headers: extraHeaders } = normalizeOptions(extra);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const query = params ? buildQuery(params) : '';
  const url = `${API_BASE}${cleanEndpoint}${query}`;

  const headers = new Headers({
    // No fijamos Content-Type si el body es FormData
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(extraHeaders || {}),
  });

  const init = {
    method,
    headers,
    credentials: 'include',
  };

  if (method.toUpperCase() !== 'GET' && body != null) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
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
    // Si no es JSON, intenta devolver texto (útil para endpoints simples)
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
