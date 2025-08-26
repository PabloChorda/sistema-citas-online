// src/api/adminMetrics.ts

// ---------- Tipos ----------
export type WhatsAppDaily = { day: string; count: number };
export type WhatsAppMetrics = {
  range_days: number;
  created_per_day: WhatsAppDaily[];
  consumed_per_day: WhatsAppDaily[];
  totals: { created: number; consumed: number; conversion_rate: number };
};

export type OTPDaily = { day: string; count: number };
export type OTPMetrics = {
  range_days: number;
  issued_per_day: OTPDaily[];
  verified_per_day: OTPDaily[];
  expired_per_day: OTPDaily[];
  totals: {
    issued: number;
    verified: number;
    expired: number;
    verify_rate: number;
    avg_attempts_verified: number;
  };
};

export type WebhookSender = { from: string; events: number };
export type WebhookTotalsByType = { event_type: string; count: number };
export type WebhookMetrics = {
  window_minutes: number;
  since: string;
  recent: { total_events: number; unique_senders: number };
  totals_by_type: WebhookTotalsByType[];
  duplicates_guard: number;
  invalid_signatures: number;
  top_senders: WebhookSender[];
};

// ---------- Config ----------
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5001/api";

// Sincroniza access_token por compatibilidad (accessToken -> access_token)
export function ensureTokenSync() {
  try {
    const at = localStorage.getItem("accessToken");
    if (at && localStorage.getItem("access_token") !== at) {
      localStorage.setItem("access_token", at);
    }
  } catch {}
}

function getAccessToken(): string | null {
  const keys = ["access_token", "accessToken"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

function setAccessToken(token: string) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("accessToken", token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("userRole");
}

// ---------- Refresh helper ----------
async function tryRefreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rt}`,
    },
    credentials: "include",
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

// ---------- Helper fetch ----------
async function apiGet<T>(path: string): Promise<T> {
  const doFetch = async () => {
    const token = getAccessToken();
    return fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
  };

  let res = await doFetch();

  // Si caducó, intentamos refresh y reintentamos UNA vez
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      // refresh inválido/caducado: limpiamos y mandamos a login
      clearTokens();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
      // y lanzamos el error para cortar la ejecución actual
      throw new Error(`GET ${path} 401: Token expired`);
    }
  }

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = JSON.stringify(data);
    } catch {
      try {
        detail = await res.text();
      } catch {}
    }
    throw new Error(`GET ${path} ${res.status}: ${detail || res.statusText}`);
  }

  return res.json();
}

// ---------- Endpoints ----------
export const fetchWhatsAppMetrics = (days = 14) =>
  apiGet<WhatsAppMetrics>(`/admin/metrics/whatsapp?days=${Number(days)}`);

export const fetchOTPMetrics = (days = 14) =>
  apiGet<OTPMetrics>(`/admin/metrics/otp?days=${Number(days)}`);

export const fetchWebhookMetrics = (minutes = 60, top = 5) =>
  apiGet<WebhookMetrics>(`/admin/metrics/webhook?minutes=${Number(minutes)}&top=${Number(top)}`);
