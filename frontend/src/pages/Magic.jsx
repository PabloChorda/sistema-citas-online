// frontend/src/pages/Magic.jsx

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { redeemMagicToken } from "../services/authService";

// next seguro: solo rutas internas
function getSafeNext(searchParams) {
  const raw = searchParams.get("next");
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

export default function Magic() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("validating"); // validating | ok | error
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const next = getSafeNext(searchParams);

    if (!token) {
      toast.error("Falta el token");
      setStatus("error");
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        // El backend devuelve { access_token, refresh_token, profile_complete, ... }
        const { profile_complete } = await redeemMagicToken(token);

        // Notificar cambios de storage al mismo tab (AuthContext escucha este evento)
        try {
          window.dispatchEvent(new Event("storage"));
        } catch {}

        setStatus("ok");

        const target = profile_complete ? next : "/dashboard/client/profile";
        // pequeña pausa para que el usuario vea el estado
        setTimeout(() => navigate(target, { replace: true }), 500);
      } catch (err) {
        const msg =
          err?.response?.data?.msg ||
          err?.message ||
          "Enlace inválido o caducado";
        toast.error(msg);
        setStatus("error");
        navigate("/login", { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-2">Accediendo…</h1>
        {status === "validating" && (
          <p className="text-gray-600">Validando enlace mágico, un momento…</p>
        )}
        {status === "ok" && (
          <p className="text-green-600">Listo. Redirigiendo…</p>
        )}
        {status === "error" && (
          <p className="text-red-600">No se pudo validar el enlace.</p>
        )}
      </div>
    </div>
  );
}
