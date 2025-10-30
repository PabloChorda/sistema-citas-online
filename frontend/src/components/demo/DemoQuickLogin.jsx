// frontend/src/components/demo/DemoQuickLogin.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { API_BASE, setAccessToken, setRefreshToken, authFetch } from "../../api/http";

export default function DemoQuickLogin({ className = "" }) {
  // Solo visible en modo demo
  if (import.meta.env.VITE_DEMO_MODE !== "1") return null;

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inputRef = useRef(null);

  const [token, setToken] = useState(
    // Si pasas VITE_DEMO_TOKEN en .env, se precarga
    import.meta.env.VITE_DEMO_TOKEN || ""
  );
  const [busy, setBusy] = useState(false);

  // Si abres /login?demo=1, enfoca el campo
  useEffect(() => {
    if (params.get("demo") === "1" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [params]);

  const useToken = async () => {
    const t = token.trim();
    if (!t) {
      toast.error("Pega un token JWT válido.");
      return;
    }
    try {
      setBusy(true);
      // Guardamos el access token y limpiamos refresh (demo = sólo-lectura)
      setAccessToken(t);
      setRefreshToken("");

      // Validamos contra /auth/me
      const res = await authFetch(`${API_BASE}/auth/me`, { method: "GET" });
      if (!res.ok) {
        // si falla, limpiamos y avisamos
        setAccessToken("");
        toast.error("Token inválido o expirado.");
        return;
      }
      const me = await res.json();
      toast.success(`Sesión demo como ${me?.email || "usuario"} ✅`);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error("No se pudo validar el token.");
    } finally {
      setBusy(false);
    }
  };

  const api =
    (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE) || "http://localhost:5001/api";

  return (
    <div
      className={`rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-900 ${className}`}
      style={{ display: "grid", gap: 8 }}
    >
      <div className="text-sm">
        <strong>Acceso rápido (demo):</strong> pega un <code>access_token</code> y entra sin registro.
      </div>

      <label className="text-xs opacity-80">API: {api}</label>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="Pega aquí el JWT de demo…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 rounded-md border border-yellow-300 bg-white px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={useToken}
          disabled={busy}
          className="rounded-md px-3 py-2 text-sm text-white"
          style={{ background: busy ? "#a8a29e" : "#4f46e5" }}
        >
          {busy ? "Validando…" : "Usar token"}
        </button>
      </div>

      <details className="text-xs opacity-90">
        <summary className="cursor-pointer">¿Dónde saco el token?</summary>
        <div className="mt-2 space-y-1">
          <div>1) <code>docker compose exec backend sh -lc "flask --app wsgi:app demo token"</code></div>
          <div>2) Copia la última línea (JWT) y pégala arriba.</div>
        </div>
      </details>
    </div>
  );
}
