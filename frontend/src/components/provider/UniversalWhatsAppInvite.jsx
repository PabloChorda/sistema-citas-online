import { useEffect, useMemo, useState } from "react";

/**
 * Normaliza teléfonos sencillos a E.164 con heurísticas suaves para ES.
 * - Si ya empieza por "+", se respeta.
 * - Si empieza por "34" y tiene 11 dígitos -> añade "+".
 * - Si tiene 9 dígitos -> asume España y antepone +34.
 */
function normalizeE164Loose(phoneRaw) {
  if (!phoneRaw) return "";
  const trimmed = String(phoneRaw).trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";

  if (digits.startsWith("34") && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+34${digits}`;
  }
  // último recurso: si hay dígitos, pon + delante (mejor que nada)
  return `+${digits}`;
}

/**
 * Muestra un QR + acciones para compartir un enlace universal de WhatsApp.
 * Props:
 *  - businessPhoneE164: string (+34600111222) — si llega sin + lo normalizamos
 *  - presetText: string (por defecto "RESERVAR")
 */
export default function UniversalWhatsAppInvite({
  businessPhoneE164,
  presetText = "RESERVAR",
}) {
  // Decide el teléfono: prop > VITE_WHATSAPP_NUMBER > vacío
  const rawPhone = useMemo(() => {
    const envPhone = import.meta.env.VITE_WHATSAPP_NUMBER || "";
    return (businessPhoneE164 || envPhone || "").trim();
  }, [businessPhoneE164]);

  const phone = useMemo(() => normalizeE164Loose(rawPhone), [rawPhone]);

  // Enlace universal de WhatsApp
  const waLink = useMemo(() => {
    if (!phone) return "";
    const base = `https://wa.me/${phone.replace(/^\+/, "")}`;
    const qs = new URLSearchParams({ text: presetText }).toString();
    return `${base}?${qs}`;
  }, [phone, presetText]);

  // QR: intenta cargar "qrcode" dinámicamente; si falla, usa fallback
  const [qrSrc, setQrSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function makeQR() {
      if (!waLink) {
        setQrSrc("");
        return;
      }
      try {
        const mod = await import(/* @vite-ignore */ "qrcode").catch(() => null);
        if (mod?.toDataURL) {
          const dataUrl = await mod.toDataURL(waLink, { width: 240, margin: 2 });
          if (!cancelled) setQrSrc(dataUrl);
          return;
        }
      } catch {
        /* ignore */
      }
      const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
        waLink
      )}`;
      if (!cancelled) setQrSrc(fallback);
    }
    makeQR();
    return () => {
      cancelled = true;
    };
  }, [waLink]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(waLink);
      alert("Enlace copiado al portapapeles");
    } catch {
      alert("No se pudo copiar el enlace");
    }
  };

  const downloadQR = () => {
    if (!qrSrc) return;
    const a = document.createElement("a");
    a.href = qrSrc;
    a.download = "qr-whatsapp.png";
    a.click();
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
      {/* QR */}
      <div className="w-full md:w-auto flex justify-center">
        <div className="w-40 sm:w-48 md:w-56 aspect-square bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="QR WhatsApp"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="text-xs text-gray-500 p-3 text-center">
              Generando QR…
            </div>
          )}
        </div>
      </div>

      {/* Texto + acciones */}
      <div className="flex-1 w-full">
        <p className="text-sm text-gray-700 leading-relaxed">
          Imprime este <strong>QR</strong> y colócalo en el mostrador. Al
          escanearlo, se abrirá WhatsApp con el mensaje “{presetText}”. Tu
          equipo podrá responder y, más adelante, automatizaremos el envío de un
          enlace de acceso rápido para reservar sin registrarse.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={waLink || undefined}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm border transition
              ${
                waLink
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
              }`}
            aria-disabled={!waLink}
          >
            Abrir conversación de WhatsApp
          </a>

          <button
            type="button"
            onClick={copyLink}
            disabled={!waLink}
            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm border transition
              ${
                waLink
                  ? "bg-white text-gray-800 hover:bg-gray-50 border-gray-300"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
              }`}
          >
            Copiar enlace
          </button>

          <button
            type="button"
            onClick={downloadQR}
            disabled={!qrSrc}
            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm border transition sm:col-span-2
              ${
                qrSrc
                  ? "bg-white text-gray-800 hover:bg-gray-50 border-gray-300"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
              }`}
          >
            Descargar QR (PNG)
          </button>
        </div>

        {!phone && (
          <p className="mt-3 text-xs text-amber-600">
            Falta configurar el número de WhatsApp. Define{" "}
            <code className="px-1 py-0.5 bg-amber-50 rounded border border-amber-200">
              VITE_WHATSAPP_NUMBER
            </code>{" "}
            o guarda el <strong>teléfono de negocio</strong> en tu perfil.
          </p>
        )}
      </div>
    </div>
  );
}
