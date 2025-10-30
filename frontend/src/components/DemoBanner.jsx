// frontend/src/components/DemoBanner.jsx
import React, { useEffect, useState } from "react";

// Normaliza booleanos desde env: "1" | "true" | "TRUE"
const isTruthy = (v) =>
  String(v ?? "").trim().toLowerCase() === "1" ||
  String(v ?? "").trim().toLowerCase() === "true";

export default function DemoBanner() {
  const demoMode = isTruthy(import.meta.env.VITE_DEMO_MODE);
  if (!demoMode) return null;

  // Permitir cerrar el banner hasta que se recargue la pestaña
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // si quieres que persista entre recargas, usa localStorage:
    // setHidden(localStorage.getItem("demoBannerHidden") === "1");
  }, []);
  if (hidden) return null;

  const hint =
    import.meta.env.VITE_DEMO_HINT ||
    "Entorno DEMO: algunas acciones están en modo solo lectura. Usa el flujo guiado para reservar.";

  const rawBase = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE;
  const apiBase = rawBase
    ? (rawBase.endsWith("/api") ? rawBase : `${String(rawBase).replace(/\/+$/, "")}/api`)
    : "http://localhost:5001/api";

  return (
    <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 px-4 border-b border-yellow-300 sticky top-0 z-[999]">
      <div className="max-w-screen-xl mx-auto flex items-center gap-3">
        <span className="shrink-0">⚠️</span>
        <span className="grow">
          <strong>DEMO:</strong> {hint}
        </span>
        <span className="hidden sm:block opacity-80 shrink-0">
          API: {apiBase}
        </span>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            // si quieres persistir entre recargas: localStorage.setItem("demoBannerHidden","1");
          }}
          className="ml-2 rounded-md border border-yellow-300 px-2 py-0.5 hover:bg-yellow-200"
          aria-label="Ocultar aviso de demo"
          title="Ocultar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
