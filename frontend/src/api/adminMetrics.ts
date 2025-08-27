// src/api/adminMetrics.ts
import { apiGetJson } from "./http";

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

// ---------- Endpoints ----------
export const fetchWhatsAppMetrics = (days = 14) =>
  apiGetJson<WhatsAppMetrics>(`/admin/metrics/whatsapp?days=${Number(days)}`);

export const fetchOTPMetrics = (days = 14) =>
  apiGetJson<OTPMetrics>(`/admin/metrics/otp?days=${Number(days)}`);

export const fetchWebhookMetrics = (minutes = 60, top = 5) =>
  apiGetJson<WebhookMetrics>(
    `/admin/metrics/webhook?minutes=${Number(minutes)}&top=${Number(top)}`
  );
