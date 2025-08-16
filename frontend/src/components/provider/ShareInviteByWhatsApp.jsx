// frontend/src/components/provider/ShareInviteByWhatsApp.jsx
import React, { useState } from "react";
import Button from '../ui/Button';// ajusta si Button está en otra ruta
import { Copy } from "lucide-react";

const ShareInviteByWhatsApp = ({ inviteUrl }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (!inviteUrl) return;

    const text = `Reserva tu cita fácilmente desde este enlace: ${inviteUrl}`;

    // Si el navegador soporta navigator.share (móvil)
    if (navigator.share) {
      navigator
        .share({
          title: "Reserva tu cita",
          text,
          url: inviteUrl,
        })
        .catch((err) => console.log("Error al compartir:", err));
    } else {
      // Fallback: abrir WhatsApp directamente
      const encoded = encodeURIComponent(text);
      const waUrl = `https://wa.me/?text=${encoded}`;
      window.open(waUrl, "_blank");
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;

    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleShare}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        Compartir por WhatsApp
      </Button>
      <Button
        onClick={handleCopy}
        variant="outline"
        className="flex items-center gap-1"
      >
        <Copy className="w-4 h-4" />
        {copied ? "Copiado" : "Copiar enlace"}
      </Button>
    </div>
  );
};

export default ShareInviteByWhatsApp;
