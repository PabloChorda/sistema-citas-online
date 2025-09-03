// src/services/apiClient.js
import { API_BASE, authFetch, clearTokens } from '../api/http';

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
 * - Soporta body JSON automáticamente salvo en GET y soporta FormData.
 * - Soporta params de query vía 4º argumento: apiClient('/path', 'GET', null, { params:{...} })
 * - Devuelve JSON si el servidor lo envía; si no, intenta texto. Para 204, null.
 * - Si tras el refresh persiste un 401, limpia tokens y redirige a /login?next=...
 */
export async function apiClient(endpoint, method = 'GET', body = null, extra = undefined) {
  const { params, headers: extraHeaders } = normalizeOptions(extra);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const query = params ? buildQuery(params) : '';
  const url = `${API_BASE}${cleanEndpoint}${query}`;

  const headers = new Headers({
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
    try { data = await res.json(); } catch { data = null; }
  } else {
    try { data = await res.text(); } catch { data = null; }
  }

  if (!res.ok) {
    // Redirección a login si queda 401 después del intento de refresh
    if (res.status === 401) {
      const isAuthEndpoint = cleanEndpoint.startsWith('/auth') || cleanEndpoint.includes('/auth/');
      const onLoginPage = window.location.pathname.startsWith('/login');
      if (!isAuthEndpoint && !onLoginPage) {
        try { clearTokens(); } catch {}
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    }

    const msg =
      (data && (data.msg || data.error || data.detail)) ||
      `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.response = { status: res.status, data };
    throw err;
  }

  return data;
}
