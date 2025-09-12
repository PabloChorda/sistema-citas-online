// frontend/src/api/http.js
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/api';

// --- tokens helpers (compat: dos claves) ---
const getAccessToken = () =>
  localStorage.getItem('access_token') || localStorage.getItem('accessToken');

const getRefreshToken = () =>
  localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');

const dispatchStorage = () => {
  try { window.dispatchEvent(new Event('storage')); } catch {}
};

const setAccessToken = (t) => {
  if (!t) return;
  localStorage.setItem('access_token', t);
  localStorage.setItem('accessToken', t);
  dispatchStorage();
};

const setRefreshToken = (t) => {
  if (!t) return;
  localStorage.setItem('refresh_token', t);
  localStorage.setItem('refreshToken', t);
  dispatchStorage();
};

const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
  dispatchStorage();
};

/** Redirige a /login preservando la ruta actual en ?next= */
function redirectToLogin() {
  try {
    const here = window.location.pathname + window.location.search;
    const next = encodeURIComponent(here);
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?next=${next}`);
    }
  } catch { /* noop */ }
}

// --- Refresh (serializado) ---
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
      const newAccess =
        data?.access_token || data?.accessToken || data?.token || null;
      if (!newAccess) throw new Error('refresh_no_token');
      setAccessToken(newAccess);
      return newAccess;
    })
    .finally(() => { refreshingPromise = null; });

  return refreshingPromise;
}

// Utilidades de detección de body JSON
const isFormLike = (b) =>
  (typeof FormData !== 'undefined' && b instanceof FormData) ||
  (typeof Blob !== 'undefined' && b instanceof Blob);

const mightBeJsonBody = (method, body) =>
  method && !['GET','HEAD'].includes(String(method).toUpperCase()) &&
  body && typeof body === 'object' && !isFormLike(body);

// --- authFetch con reintento tras refresh ---
async function authFetch(input, init = {}) {
  const reqUrl =
    typeof input === 'string'
      ? input
      : (input && typeof input === 'object' && 'url' in input ? input.url : '');
  const isRefreshCall = reqUrl.includes('/auth/refresh');

  // Construye headers
  const headers = new Headers(init.headers || {});
  const at = getAccessToken();
  if (at && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${at}`);
  }
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  let body = init.body;

  // Si nos pasan un objeto JS como body en métodos con cuerpo, lo serializamos como JSON
  if (mightBeJsonBody(init.method, body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    // Evita doble stringify si ya viene string
    if (typeof body !== 'string') body = JSON.stringify(body);
  }

  const mkReq = (h, b) => ({
    ...init,
    headers: h,
    body: b,
    credentials: init.credentials ?? 'include',
  });

  let res = await fetch(input, mkReq(headers, body));

  // 401/419: intenta un refresh (solo si no estamos ya en /auth/refresh)
  const shouldTryRefresh =
    (res.status === 401 || res.status === 419) && !isRefreshCall;

  if (shouldTryRefresh) {
    try {
      await refreshAccessToken(); // serializado entre llamadas
      const headers2 = new Headers(init.headers || {});
      const at2 = getAccessToken();
      if (at2) headers2.set('Authorization', `Bearer ${at2}`);
      if (!headers2.has('Accept')) headers2.set('Accept', 'application/json');

      // Reaplica Content-Type solo si sigue siendo JSON “auto”
      if (mightBeJsonBody(init.method, init.body) && !headers2.has('Content-Type')) {
        headers2.set('Content-Type', 'application/json');
      }

      const retryBody =
        mightBeJsonBody(init.method, init.body) && typeof init.body !== 'string'
          ? JSON.stringify(init.body)
          : init.body;

      res = await fetch(input, mkReq(headers2, retryBody));
    } catch {
      clearTokens();
      redirectToLogin();
      return res; // devolvemos el 401 original
    }
  }

  return res;
}

// --- helpers JSON de conveniencia ---
async function parseOrThrow(res, verb, path) {
  if (!res.ok) {
    let detail = '';
    try {
      // intenta extraer msg del backend si vino JSON
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        detail = j?.msg || JSON.stringify(j);
      } else {
        detail = await res.text();
      }
    } catch {}
    throw new Error(`${verb} ${path} ${res.status}: ${detail || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  // Si no vino JSON, devuelve texto para no romper
  return res.text();
}

async function apiGetJson(path, cfg) {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'GET', ...(cfg || {}) });
  return parseOrThrow(res, 'GET', path);
}

async function apiPostJson(path, body, cfg) {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'POST', body, ...(cfg || {}) });
  return parseOrThrow(res, 'POST', path);
}

async function apiPutJson(path, body, cfg) {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'PUT', body, ...(cfg || {}) });
  return parseOrThrow(res, 'PUT', path);
}

async function apiDelete(path, cfg) {
  const res = await authFetch(`${API_BASE}${path}`, { method: 'DELETE', ...(cfg || {}) });
  return parseOrThrow(res, 'DELETE', path);
}

export {
  API_BASE,
  authFetch,
  apiGetJson,
  apiPostJson,
  apiPutJson,
  apiDelete,
  setAccessToken,
  setRefreshToken,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  refreshAccessToken,
};
