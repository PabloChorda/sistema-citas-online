// src/pages/AdminMetricsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchWhatsAppMetrics,
  fetchOTPMetrics,
  fetchWebhookMetrics,
} from "../api/adminMetrics";
import Button from "../components/ui/Button";
import { toCSV, downloadCSV } from "../utils/csv";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

// ——— Utilidades ———
const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
const pct = (n) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
const fmtDate = (s) => {
  try {
    const d = new Date(s);
    return d.toLocaleDateString();
  } catch {
    return s || "—";
  }
};

// --- LS helpers (persistencia de ajustes) ---
const LS_KEYS = {
  rangeDays: "metrics.rangeDays",
  whMinutes: "metrics.whMinutes",
  whTop: "metrics.whTop",
  autoRefresh: "metrics.autoRefresh",
  refreshSec: "metrics.refreshSec",
};

const readLSInt = (k, fallback) => {
  const raw = localStorage.getItem(k);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};
const readLSBool = (k, fallback) => {
  const raw = localStorage.getItem(k);
  if (raw == null) return fallback;
  return raw === "true";
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {}
};

// ===== TokenBadge aislado (no re-renderiza toda la página) =====
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json || null;
  } catch {
    return null;
  }
}
function TokenBadge() {
  const show = import.meta.env.MODE === "development";
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!show) return;
    const t =
      localStorage.getItem("access_token") || localStorage.getItem("accessToken");
    const data = decodeJwt(t);
    if (!data?.exp) {
      setLeft(null);
      return;
    }
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setLeft(Math.max(0, data.exp - now));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [show]);

  if (!show || left == null) return null;

  const m = Math.floor(left / 60);
  const s = left % 60;
  const critical = left <= 120;

  return (
    <span
      className={
        "ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs " +
        (critical ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")
      }
      title="Tiempo restante del access_token (solo visible en dev)"
    >
      Sesión: {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

// Switch accesible y con estilos de marca
function UISwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || "Activar/desactivar"}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 items-center rounded-full transition " +
        (checked ? "bg-primary-500" : "bg-slate-300")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}

// Tooltips custom
function Dot({ color }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full mr-2"
      style={{ background: color }}
    />
  );
}

function CustomLineTooltip({ active, label, payload, colors, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-brand-100 bg-white shadow p-3 text-xs">
      {title && <div className="text-[11px] text-slate-500 mb-1">{title}</div>}
      <div className="font-medium mb-1">{fmtDate(label)}</div>
      <ul className="space-y-1">
        {payload.map((item, idx) => {
          const key = item.dataKey || item.name;
          const color = colors?.[key] || item.color || "#334155";
          const val = Number(item.value);
          return (
            <li key={idx} className="flex items-center">
              <Dot color={color} />
              <span className="mr-2">{key}</span>
              <span className="font-semibold">{fmt(val)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CustomBarTooltip({ active, label, payload, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-brand-100 bg-white shadow p-3 text-xs">
      {title && <div className="text-[11px] text-slate-500 mb-1">{title}</div>}
      {label && <div className="font-medium mb-1">{label}</div>}
      <ul className="space-y-1">
        {payload.map((item, idx) => (
          <li key={idx} className="flex items-center">
            <Dot color={item.fill || item.color || "#334155"} />
            <span className="mr-2">{item.name || item.dataKey}</span>
            <span className="font-semibold">{fmt(Number(item.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Une series por day en un array ordenado
function mergeByDay(seriesMap) {
  const allDays = new Set();
  Object.values(seriesMap).forEach((arr) => {
    (arr || []).forEach((r) => allDays.add(r.day));
  });
  const days = Array.from(allDays);
  days.sort((a, b) => new Date(a) - new Date(b));
  return days.map((d) => {
    const row = { day: d };
    for (const [key, arr] of Object.entries(seriesMap)) {
      const found = (arr || []).find((r) => r.day === d);
      row[key] = found ? Number(found.count) : 0;
    }
    return row;
  });
}

export default function AdminMetricsPage() {
  const [wa, setWa] = useState(null);
  const [otp, setOtp] = useState(null);
  const [wh, setWh] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Ajustes (persistidos)
  const [showSettings, setShowSettings] = useState(false);
  const [rangeDays, setRangeDays] = useState(() => readLSInt(LS_KEYS.rangeDays, 14)); // 7/14/30
  const [whMinutes, setWhMinutes] = useState(() => readLSInt(LS_KEYS.whMinutes, 60)); // 15/30/60/120
  const [whTop, setWhTop] = useState(() => readLSInt(LS_KEYS.whTop, 5)); // 3/5/10

  // Auto-refresh (persistidos)
  const [autoRefresh, setAutoRefresh] = useState(() => readLSBool(LS_KEYS.autoRefresh, false));
  const [refreshSec, setRefreshSec] = useState(() => readLSInt(LS_KEYS.refreshSec, 60)); // 30/60/120

  // Persistir cuando cambien
  useEffect(() => {
    writeLS(LS_KEYS.rangeDays, rangeDays);
  }, [rangeDays]);
  useEffect(() => {
    writeLS(LS_KEYS.whMinutes, whMinutes);
  }, [whMinutes]);
  useEffect(() => {
    writeLS(LS_KEYS.whTop, whTop);
  }, [whTop]);
  useEffect(() => {
    writeLS(LS_KEYS.autoRefresh, autoRefresh);
  }, [autoRefresh]);
  useEffect(() => {
    writeLS(LS_KEYS.refreshSec, refreshSec);
  }, [refreshSec]);

  // Colores por serie (marca)
  const waColors = {
    created: "#2563eb", // blue-600
    consumed: "#10b981", // emerald-500
  };
  const otpColors = {
    issued: "#2563eb",
    verified: "#10b981",
    expired: "#ef4444", // red-500
  };

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const [waRes, otpRes, whRes] = await Promise.all([
        fetchWhatsAppMetrics(rangeDays),
        fetchOTPMetrics(rangeDays),
        fetchWebhookMetrics(whMinutes, whTop),
      ]);
      setWa(waRes);
      setOtp(otpRes);
      setWh(whRes);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setErr(e?.message || "No se pudieron cargar las métricas. Verifica tu token o el backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      loadAll();
    }, Math.max(10, refreshSec) * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshSec, rangeDays, whMinutes, whTop]); // refresca si cambian ajustes

  // Datos para gráficas
  const waChartData = useMemo(() => {
    if (!wa) return [];
    return mergeByDay({
      created: wa.created_per_day || [],
      consumed: wa.consumed_per_day || [],
    });
  }, [wa]);

  const otpChartData = useMemo(() => {
    if (!otp) return [];
    return mergeByDay({
      issued: otp.issued_per_day || [],
      verified: otp.verified_per_day || [],
      expired: otp.expired_per_day || [],
    });
  }, [otp]);

  const whBarData = useMemo(() => {
    if (!wh?.totals_by_type) return [];
    return (wh.totals_by_type || []).map((r) => ({
      type: r.event_type,
      count: Number(r.count),
    }));
  }, [wh]);

  // ---- Exportaciones CSV ----
  const exportWaCSV = () => {
    if (!wa) return;
    const rows = (waChartData || []).map((r) => ({
      day: r.day,
      created: Number(r.created ?? 0),
      consumed: Number(r.consumed ?? 0),
    }));
    const csv = toCSV(rows, [
      { key: "day", label: "day" },
      { key: "created", label: "created" },
      { key: "consumed", label: "consumed" },
    ]);
    downloadCSV(`wa_invites_${wa?.range_days ?? "range"}d.csv`, csv);
  };

  const exportOtpCSV = () => {
    if (!otp) return;
    const rows = (otpChartData || []).map((r) => ({
      day: r.day,
      issued: Number(r.issued ?? 0),
      verified: Number(r.verified ?? 0),
      expired: Number(r.expired ?? 0),
    }));
    const csv = toCSV(rows, [
      { key: "day", label: "day" },
      { key: "issued", label: "issued" },
      { key: "verified", label: "verified" },
      { key: "expired", label: "expired" },
    ]);
    downloadCSV(`otp_${otp?.range_days ?? "range"}d.csv`, csv);
  };

  const exportWebhookTopCSV = () => {
    if (!wh) return;
    const rows = (wh.top_senders || []).map((r) => ({
      from: r.from,
      events: Number(r.events ?? 0),
    }));
    const csv = toCSV(rows, [
      { key: "from", label: "from" },
      { key: "events", label: "events" },
    ]);
    downloadCSV(`webhook_top_${wh?.window_minutes ?? 60}m.csv`, csv);
  };

  const exportWebhookTypesCSV = () => {
    if (!wh) return;
    const rows = (wh.totals_by_type || []).map((r) => ({
      event_type: r.event_type,
      count: Number(r.count ?? 0),
    }));
    const csv = toCSV(rows, [
      { key: "event_type", label: "event_type" },
      { key: "count", label: "count" },
    ]);
    downloadCSV(`webhook_types_${wh?.window_minutes ?? 60}m.csv`, csv);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Métricas (Admin / Provider)</h1>
          <p className="text-sm text-slate-500">
            WhatsApp invites, OTP y salud del webhook.
          </p>
          <TokenBadge />
        </div>

        <div className="relative flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Última actualización:{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <Button variant="primary" size="sm" onClick={loadAll} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </Button>
          <Button
            variant="secondarySoft"
            size="sm"
            onClick={() => setShowSettings((v) => !v)}
            title="Ajustes"
          >
            Ajustes
          </Button>

          {/* Panel de ajustes */}
          {showSettings && (
            <div className="absolute right-0 top-12 z-20 w-[320px] rounded-xl border bg-white shadow-lg p-4">
              <div className="text-sm font-medium mb-3">Ajustes de métricas</div>

              <div className="space-y-3">
                {/* Rango días */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Rango (días)</label>
                  <select
                    className="rounded-lg border px-2 py-1 text-sm"
                    value={rangeDays}
                    onChange={(e) => setRangeDays(Number(e.target.value))}
                  >
                    <option value={7}>7</option>
                    <option value={14}>14</option>
                    <option value={30}>30</option>
                  </select>
                </div>

                {/* Webhook: minutos */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Webhook (min)</label>
                  <select
                    className="rounded-lg border px-2 py-1 text-sm"
                    value={whMinutes}
                    onChange={(e) => setWhMinutes(Number(e.target.value))}
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                    <option value={120}>120</option>
                  </select>
                </div>

                {/* Webhook: top */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Webhook Top</label>
                  <select
                    className="rounded-lg border px-2 py-1 text-sm"
                    value={whTop}
                    onChange={(e) => setWhTop(Number(e.target.value))}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>

                {/* Auto-refresh */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Auto-refresh</label>
                  <div className="flex items-center gap-2">
                    <UISwitch
                      checked={autoRefresh}
                      onChange={setAutoRefresh}
                      label="Auto refresh"
                    />
                    <select
                      className="rounded-lg border px-2 py-1 text-sm"
                      value={refreshSec}
                      onChange={(e) => setRefreshSec(Number(e.target.value))}
                      disabled={!autoRefresh}
                    >
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                      <option value={120}>120s</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="link" size="sm" onClick={() => setShowSettings(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowSettings(false);
                    loadAll();
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {err && (
        <div className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-rose-800 text-sm">
          {err}
        </div>
      )}

      {/* WhatsApp */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">
          WhatsApp Invites ({wa?.range_days ?? rangeDays} días)
        </h2>
        {!wa ? (
          <div className="text-sm text-slate-500">Cargando…</div>
        ) : (
          <div className="rounded-lg border bg-white">
            {/* Toolbar de exportación */}
            <div className="p-3 border-b flex justify-end">
              <Button size="sm" variant="outline" onClick={exportWaCSV}>
                Exportar CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
              <Stat label="Invites creadas" value={fmt(wa?.totals?.created)} />
              <Stat label="Invites consumidas" value={fmt(wa?.totals?.consumed)} />
              <Stat label="Conversión" value={pct(wa?.totals?.conversion_rate)} />
              <Stat label="Ventana (días)" value={fmt(wa?.range_days)} />
            </div>

            {/* Gráfica responsiva */}
            <div className="p-4 border-t">
              <div className="text-sm font-medium mb-2">Creadas vs Consumidas</div>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer>
                  <LineChart
                    data={waChartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={fmtDate} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={<CustomLineTooltip colors={waColors} title="WhatsApp" />}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="created"
                      name="created"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="consumed"
                      name="consumed"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tablas por día */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border-t">
              <SeriesTable title="Creadas por día" data={wa?.created_per_day} />
              <SeriesTable title="Consumidas por día" data={wa?.consumed_per_day} />
            </div>
          </div>
        )}
      </section>

      {/* OTP */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">
          OTP ({otp?.range_days ?? rangeDays} días)
        </h2>
        {!otp ? (
          <div className="text-sm text-slate-500">Cargando…</div>
        ) : (
          <div className="rounded-lg border bg-white">
            {/* Toolbar de exportación */}
            <div className="p-3 border-b flex justify-end">
              <Button size="sm" variant="outline" onClick={exportOtpCSV}>
                Exportar CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4">
              <Stat label="Emitidos" value={fmt(otp?.totals?.issued)} />
              <Stat label="Verificados" value={fmt(otp?.totals?.verified)} />
              <Stat label="Expirados" value={fmt(otp?.totals?.expired)} />
              <Stat label="Ratio verificación" value={pct(otp?.totals?.verify_rate)} />
              <Stat
                label="Intentos (media verificados)"
                value={fmt(otp?.totals?.avg_attempts_verified)}
              />
            </div>

            {/* Gráfica responsiva */}
            <div className="p-4 border-t">
              <div className="text-sm font-medium mb-2">
                Emitidos / Verificados / Expirados
              </div>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer>
                  <LineChart
                    data={otpChartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={fmtDate} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={<CustomLineTooltip colors={otpColors} title="OTP" />}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="issued"
                      name="issued"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="verified"
                      name="verified"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expired"
                      name="expired"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border-t">
              <SeriesTable title="Emitidos por día" data={otp?.issued_per_day} />
              <SeriesTable title="Verificados por día" data={otp?.verified_per_day} />
              <SeriesTable title="Expirados por día" data={otp?.expired_per_day} />
            </div>
          </div>
        )}
      </section>

      {/* Webhook */}
      <section>
        <h2 className="text-lg font-semibold mb-1">
          Webhook (últimos {wh?.window_minutes ?? whMinutes} min)
        </h2>
        {!wh ? (
          <div className="text-sm text-slate-500">Cargando…</div>
        ) : (
          <div className="rounded-lg border bg-white">
            {/* Toolbar de exportación */}
            <div className="p-3 border-b flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={exportWebhookTopCSV}>
                Top emisores CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportWebhookTypesCSV}>
                Totales por tipo CSV
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
              <Stat label="Eventos recientes" value={fmt(wh?.recent?.total_events)} />
              <Stat label="Emisores únicos" value={fmt(wh?.recent?.unique_senders)} />
              <Stat label="HMAC inválidas" value={fmt(wh?.invalid_signatures)} />
              <Stat label="Duplicados (guard)" value={fmt(wh?.duplicates_guard)} />
            </div>

            {/* Barras responsivas */}
            <div className="p-4 border-t">
              <div className="text-sm font-medium mb-2">Eventos por tipo</div>
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer>
                  <BarChart
                    data={whBarData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      content={<CustomBarTooltip title="Webhook events" />}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="count"
                      fill="#2563eb"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border-t">
              <MiniList
                title="Top emisores"
                rows={(wh?.top_senders || []).map((r) => ({
                  k: r.from,
                  v: r.events,
                }))}
                empty="Sin datos."
              />
              <MiniList
                title="Totales por tipo"
                rows={(wh?.totals_by_type || []).map((r) => ({
                  k: r.event_type,
                  v: r.count,
                }))}
                empty="Sin datos."
              />
              <div className="text-xs text-slate-500">
                <div className="font-medium mb-1">Ventana</div>
                <div>
                  Desde: {wh?.since ? new Date(wh.since).toLocaleString() : "—"}
                </div>
                <div>Minutos: {fmt(wh?.window_minutes)}</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ——— Componentes pequeños ———
function Stat({ label, value }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function SeriesTable({ title, data }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-slate-500">Sin datos.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-slate-50">
                <th className="px-3 py-2">Día</th>
                <th className="px-3 py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{fmtDate(r.day)}</td>
                  <td className="px-3 py-2">{fmt(Number(r.count))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MiniList({ title, rows, empty = "Sin datos." }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      {list.length === 0 ? (
        <div className="text-xs text-slate-500">{empty}</div>
      ) : (
        <ul className="text-sm divide-y">
          {list.map((r) => (
            <li
              key={String(r.k)}
              className="flex items-center justify-between py-2"
            >
              <span className="truncate pr-3">{r.k}</span>
              <span className="font-mono">{fmt(Number(r.v))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
