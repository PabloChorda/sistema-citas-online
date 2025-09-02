// src/api/http.js
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/api';

const getAccessToken = () =>
  localStorage.getItem('access_token') || localStorage.getItem('accessToken');

const getRefreshToken = () =>
  localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');

const setAccessToken = (t) => {
  if (!t) return;
  localStorage.setItem('access_token', t);
  localStorage.setItem('accessToken', t);
};

const setRefreshToken = (t) => {
  if (!t) return;
  localStorage.setItem('refresh_token', t);
  localStorage.setItem('refreshToken', t);
};

const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('refreshToken');
};

/** Redirige a /login preservando la ruta actual en ?next= */
function redirectToLogin() {
  try {
    const here = window.location.pathname + window.location.search;
    const next = encodeURIComponent(here);
    // Evita bucle si ya estás en /login
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?next=${next}`);
    }
  } catch {
    // noop
  }
}

let refreshingPromise = null;

async function refreshAccessToken() {
  if (refreshingPromise) return refreshingPromise;

  const rt = getRefreshToken();
  if (!rt) throw new Error('no_refresh_token');

  const url = `${API_BASE}/auth/refresh`;
  refreshingPromise = fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rt}` },
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch {}
        throw new Error(`refresh_${res.status}${detail ? ' - ' + detail : ''}`);
      }
      const data = await res.json();
      const newAccess = data?.access_token || data?.accessToken || data?.token || null;
      if (!newAccess) throw new Error('refresh_no_token');
      setAccessToken(newAccess);
      return newAccess;
    })
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
}

async function authFetch(input, init = {}) {
  // Soporta tanto string como Request
  const reqUrl =
    typeof input === 'string'
      ? input
      : (input && typeof input === 'object' && 'url' in input ? input.url : '');
  const isRefreshCall = reqUrl.includes('/auth/refresh');

  const headers = new Headers(init.headers || {});
  const at = getAccessToken();
  if (at) headers.set('Authorization', `Bearer ${at}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const doFetch = (h) =>
    fetch(input, { ...init, headers: h, credentials: init.credentials ?? 'include' });

  let res = await doFetch(headers);

  // Si el access_token caducó y NO estamos en el endpoint de refresh, intenta renovar y reintentar 1 vez
  if (res.status === 401 && !isRefreshCall) {
    try {
      await refreshAccessToken(); // serializa intentos simultáneos
      const headers2 = new Headers(init.headers || {});
      const at2 = getAccessToken();
      if (at2) headers2.set('Authorization', `Bearer ${at2}`);
      if (!headers2.has('Content-Type')) headers2.set('Content-Type', 'application/json');
      res = await doFetch(headers2);
    } catch {
      // Falló el refresh → limpiamos credenciales y redirigimos a login
      clearTokens();
      redirectToLogin();
      return res; // devolvemos el 401 original por si el caller quiere gestionarlo
    }
  }

  return res;
}

async function apiGetJson(path) {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'GET' });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`GET ${path} ${res.status}: ${detail || res.statusText}`);
  }
  return res.json();
}

export {
  API_BASE,
  authFetch,
  apiGetJson,
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens,
};
