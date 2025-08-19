// frontend/src/pages/ProviderWhatsAppQR.jsx
import { useEffect, useMemo, useState } from "react";
import UniversalWhatsAppInvite from "../components/provider/UniversalWhatsAppInvite";
import { getProviderProfile } from "../services/providerService";

// helper: normaliza algo tipo "666555333" a +34666555333 (ES por defecto)
function normalizeE164Loose(phoneRaw) {
  if (!phoneRaw) return "";
  const trimmed = String(phoneRaw).trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("34") && digits.length >= 11) return `+${digits}`;
  if (digits.length === 9) return `+34${digits}`;
  return `+${digits}`;
}

export default function ProviderWhatsAppQR() {
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const presetText = "RESERVAR";

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const profile = await getProviderProfile();
        const businessPhone = normalizeE164Loose(profile?.telefono_contacto) || "";
        setPhone(businessPhone);
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar tu perfil de proveedor.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const waLink = useMemo(() => {
    if (!phone) return "";
    const base = `https://wa.me/${phone.replace(/^\+/, "")}`;
    const qs = new URLSearchParams({ text: presetText }).toString();
    return `${base}?${qs}`;
  }, [phone]);

  // Descargar PNG A4 (2480x3508 px) con título + QR + instrucciones
  const handleDownloadA4Png = async () => {
    if (!waLink) return;
    try {
      const mod = await import(/* @vite-ignore */ "qrcode");
      const W = 2480, H = 3508; // ~300 DPI para A4
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");

      // Fondo
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);

      // Título
      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      ctx.font = "bold 96px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
      ctx.fillText("Reserva por WhatsApp", W / 2, 260);

      // Subtítulo
      ctx.font = "48px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
      ctx.fillStyle = "#333333";
      ctx.fillText("Escanea este código con tu móvil", W / 2, 360);

      // QR grande
      const qrSize = 2000;
      const dataUrl = await mod.toDataURL(waLink, { width: qrSize, margin: 2 });
      const img = new Image();
      img.onload = () => {
        const x = (W - qrSize) / 2;
        const y = 520;
        ctx.drawImage(img, x, y, qrSize, qrSize);

        // Instrucciones
        ctx.fillStyle = "#333333";
        ctx.font = "44px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
        let lineY = y + qrSize + 120;
        const lines = [
          "1) Abre la cámara o WhatsApp y escanea el código.",
          `2) Se abrirá un chat con el mensaje “${presetText}”. Envíalo.`,
          "3) Recibirás un enlace para continuar y finalizar tu cita.",
        ];
        lines.forEach((t) => {
          ctx.fillText(t, W / 2, lineY);
          lineY += 70;
        });

        // URL fallback
        ctx.fillStyle = "#111111";
        ctx.font = "bold 42px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
        ctx.fillText("Si no funciona, entra en: https://tusitio.com/booking", W / 2, lineY + 60);

        // Descargar
        const out = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = out;
        a.download = "qr-whatsapp-A4.png";
        a.click();
      };
      img.onerror = () => {
        alert("No se pudo generar la imagen A4 del QR.");
      };
      img.src = dataUrl;
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el PNG A4. Revisa la consola.");
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper px-4">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper px-4">
      <header className="page-header mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Enlace & QR de WhatsApp</h1>
        <p className="text-sm text-gray-500">
          Comparte este enlace o descarga el PNG A4 para imprimirlo.
        </p>
      </header>

      <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="text-sm text-gray-600">
            {phone ? (
              <>Número de negocio: <strong>{phone}</strong></>
            ) : (
              <span className="text-amber-600">Configura tu número de WhatsApp en el perfil</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadA4Png}
              disabled={!waLink}
              className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm border ${
                waLink
                  ? "bg-white text-gray-800 hover:bg-gray-50 border-gray-300"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed border-gray-200"
              }`}
            >
              Descargar PNG (A4)
            </button>
          </div>
        </div>

        {/* Widget en pantalla con acciones habituales */}
        <UniversalWhatsAppInvite
          businessPhoneE164={phone}
          presetText={presetText}
          enableA4Actions
        />
      </section>
    </div>
  );
}
