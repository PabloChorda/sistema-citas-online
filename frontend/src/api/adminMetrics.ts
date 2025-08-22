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

// Lee token desde cualquiera de las dos claves que usamos en la app
function getToken(): string | null {
  const keys = ["access_token", "accessToken"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

/**
 * Sincroniza las dos claves de token en localStorage:
 * - Si existe en una y no en la otra, lo copia.
 * - Si existen ambos y difieren, prioriza `accessToken`.
 * Devuelve true si hizo algún cambio; además dispara un `storage` para que React
 * se entere sin recargar.
 */
export function ensureTokenSync(): boolean {
  try {
    const t1 = localStorage.getItem("accessToken");
    const t2 = localStorage.getItem("access_token");
    const chosen = t1 || t2;
    if (!chosen) return false;

    let changed = false;
    if (t2 !== chosen) {
      localStorage.setItem("access_token", chosen);
      changed = true;
    }
    if (t1 !== chosen) {
      localStorage.setItem("accessToken", chosen);
      changed = true;
    }
    if (changed) {
      // Nota: el StorageEvent nativo no se dispara en la misma pestaña,
      // pero este Event simple sí activa nuestros listeners.
      window.dispatchEvent(new Event("storage"));
    }
    return changed;
  } catch {
    return false;
  }
}

// ---------- Helper fetch ----------
async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = JSON.stringify(data);
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = "";
      }
    }
    throw new Error(`GET ${path} ${res.status}: ${detail || res.statusText}`);
  }

  return res.json();
}

// ---------- Endpoints ----------
export const fetchWhatsAppMetrics = (days: number = 14) =>
  apiGet<WhatsAppMetrics>(`/admin/metrics/whatsapp?days=${Number(days)}`);

export const fetchOTPMetrics = (days: number = 14) =>
  apiGet<OTPMetrics>(`/admin/metrics/otp?days=${Number(days)}`);

export const fetchWebhookMetrics = (minutes: number = 60, top: number = 5) => {
  const m = Number(minutes);
  const t = Number(top);
  return apiGet<WebhookMetrics>(`/admin/metrics/webhook?minutes=${m}&top=${t}`);
};
