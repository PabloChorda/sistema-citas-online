// src/api/adminMetrics.js
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5001/api';

export function ensureTokenSync() {
  try {
    const at = localStorage.getItem('accessToken');
    if (at && localStorage.getItem('access_token') !== at) {
      localStorage.setItem('access_token', at);
    }
  } catch {}
}
function getAccessToken() {
  const keys = ['access_token', 'accessToken'];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}
function getRefreshToken() {
  return localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
}
function setAccessToken(token) {
  if (!token) return;
  localStorage.setItem('access_token', token);
  localStorage.setItem('accessToken', token);
}
function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
}

async function tryRefreshAccessToken() {
  const rt = getRefreshToken();
  if (!rt) return null;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rt}`,
    },
    credentials: 'include',
  });
  if (!res.ok) return null;
  try {
    const data = await res.json();
    const at = data?.access_token;
    if (at) {
      setAccessToken(at);
      return at;
    }
  } catch {}
  return null;
}

async function apiGet(path) {
  const doFetch = async () => {
    const token = getAccessToken();
    return fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
    });
  };

  let res = await doFetch();

  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      clearTokens();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
      throw new Error(`GET ${path} 401: Token expired`);
    }
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = JSON.stringify(data);
    } catch {
      try { detail = await res.text(); } catch {}
    }
    throw new Error(`GET ${path} ${res.status}: ${detail || res.statusText}`);
  }

  return res.json();
}

export const fetchWhatsAppMetrics = (days = 14) =>
  apiGet(`/admin/metrics/whatsapp?days=${Number(days)}`);

export const fetchOTPMetrics = (days = 14) =>
  apiGet(`/admin/metrics/otp?days=${Number(days)}`);

export const fetchWebhookMetrics = (minutes = 60, top = 5) =>
  apiGet(`/admin/metrics/webhook?minutes=${Number(minutes)}&top=${Number(top)}`);
