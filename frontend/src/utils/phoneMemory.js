// frontend/src/utils/phoneMemory.js
const KEY = "last_phone_e164";
const DEFAULT_TTL_DAYS = 180;

const nowSec = () => Math.floor(Date.now() / 1000);

export function setLastPhone(value, ttlDays = DEFAULT_TTL_DAYS) {
  if (!value) return;
  try {
    const rec = { value: String(value), ts: nowSec(), ttl: ttlDays * 24 * 3600 };
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {}
}

export function getLastPhone() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    if (!rec?.value) return null;
    const ts = Number(rec.ts || 0);
    const ttl = Number(rec.ttl || 0);
    if (ttl > 0 && nowSec() - ts > ttl) {
      localStorage.removeItem(KEY);
      return null;
    }
    return rec.value;
  } catch {
    return null;
  }
}

export function clearLastPhone() {
  try { localStorage.removeItem(KEY); } catch {}
}
