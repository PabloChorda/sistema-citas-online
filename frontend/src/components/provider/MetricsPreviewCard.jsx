// src/components/provider/MetricsPreviewCard.jsx
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import { fetchWhatsAppMetrics } from "../../api/adminMetrics";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from "recharts";

const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
const pct = (n) => (typeof n === "number" ? `${(n * 100).toFixed(0)}%` : "—");
const fmtDate = (s) => {
  try {
    const d = new Date(s);
    return d.toLocaleDateString();
  } catch {
    return s || "—";
  }
};

export default function MetricsPreviewCard({
  days = 14,
  to = "/dashboard/provider/admin/metrics",
}) {
  const [wa, setWa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const data = await fetchWhatsAppMetrics(days);
        if (mounted) setWa(data);
      } catch (e) {
        if (mounted) setErr(e?.message || "No se pudo cargar la vista previa.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [days]);

  const chartData = useMemo(() => {
    const rows = wa?.created_per_day || [];
    return rows.map((r) => ({ day: r.day, created: Number(r.count || 0) }));
  }, [wa]);

  const created = wa?.totals?.created ?? null;
  const consumed = wa?.totals?.consumed ?? null;
  const conv = wa?.totals?.conversion_rate ?? null;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Métricas del sistema</h3>
          <p className="text-xs text-gray-400">
            Vista previa WhatsApp (últimos {wa?.range_days ?? days} días)
          </p>

          {/* KPIs compactos en la misma línea, tamaño text-xs y color negro */}
          <div className="mt-1 text-xs text-black flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><span className="font-medium">Creadas:</span> {fmt(created)}</span>
            <span className="text-slate-300">〰️</span>
            <span><span className="font-medium">Consumidas:</span> {fmt(consumed)}</span>
            <span className="text-slate-300"></span>
            <span><span className="font-medium">Conversión:</span> {pct(conv)}</span>
          </div>
        </div>

        <Button to={to} size="sm" variant="primarySoft" title="Abrir métricas">
          Ver métricas
        </Button>
      </div>

      <div className="mt-3 h-28 sm:h-36 w-full min-w-0">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-slate-100" />
        ) : err ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-rose-600 border border-rose-200 rounded">
            {err}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 border rounded">
            Sin datos suficientes
          </div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.36} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickMargin={6}
                tickFormatter={fmtDate}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={{ stroke: "#e5e7eb" }}
              />
              <Tooltip
                isAnimationActive={false}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
                labelFormatter={(l) => fmtDate(l)}
                formatter={(v) => [fmt(Number(v)), "Invites creadas"]}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#waGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Eliminamos la rejilla inferior para compactar la tarjeta */}
    </div>
  );
}
