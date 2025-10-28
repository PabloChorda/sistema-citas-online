import React from "react";

export default function DemoBanner() {
  if (import.meta.env.VITE_DEMO_MODE !== "1") return null;

  const hint =
    import.meta.env.VITE_DEMO_HINT ||
    "Demo en modo solo-lectura. Usa 'Probar demo' o pega un token para entrar.";

  const api =
    (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE) || "";

  return (
    <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 px-4 border-b border-yellow-300">
      <div className="max-w-screen-lg mx-auto flex items-center justify-between gap-3">
        <span>⚠️ {hint}</span>
        <span className="opacity-80">API: {api || "http://localhost:5001/api"}</span>
      </div>
    </div>
  );
}
