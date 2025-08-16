// frontend/src/services/whatsappInviteService.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

/**
 * Construye la URL de consumo del backend (redirige al frontend con el teléfono precargado).
 * Por defecto añade send=1 para que el frontend autoenvíe el OTP.
 *
 * @param {string} token
 * @param {{ next?: string, send?: boolean }} [opts]
 * @returns {string}
 */
export function buildConsumeUrl(token, opts = {}) {
  const { next, send = true } = opts;
  const params = new URLSearchParams();

  if (send) params.set("send", "1");
  if (next && typeof next === "string" && next.startsWith("/")) {
    params.set("next", next);
  }

  const qs = params.toString();
  return `${API_BASE}/api/whatsapp/invite/${token}/consume${qs ? `?${qs}` : ""}`;
}

/**
 * Crea una invitación para flujo WhatsApp ➜ login-phone.
 * Devuelve también la URL de consumo ya construida.
 *
 * @param {string} phoneNumber  Teléfono en cualquier formato (+34..., 34..., etc.)
 * @param {{ ttlMinutes?: number, next?: string }} [options]
 * @returns {Promise<{ inviteUrl: string, raw: any }>}
 */
export async function createWhatsappInvite(
  phoneNumber,
  { ttlMinutes = 60, next = "/" } = {}
) {
  const body = {
    phone_number: String(phoneNumber || "").trim(),
    ttl_minutes: ttlMinutes,
  };

  const res = await fetch(`${API_BASE}/api/whatsapp/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // si en el futuro proteges el endpoint, añade credentials y Authorization aquí
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.msg || `No se pudo crear la invitación (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const token = data?.token;
  if (!token) {
    throw new Error("La API no devolvió un token de invitación.");
  }

  const inviteUrl = buildConsumeUrl(token, { next, send: true });
  return { inviteUrl, raw: data };
}

/**
 * Consulta el estado de una invitación (válida/expirada/usada).
 * Útil si quieres validar antes de mostrar/compartir.
 *
 * @param {string} token
 * @returns {Promise<any>} respuesta JSON del backend
 */
export async function getInviteStatus(token) {
  const res = await fetch(`${API_BASE}/api/whatsapp/invite/${token}`, {
    method: "GET",
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.msg || `No se pudo consultar la invitación (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export default { buildConsumeUrl, createWhatsappInvite, getInviteStatus };
