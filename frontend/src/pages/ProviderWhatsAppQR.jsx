import React from "react";
import UniversalWhatsAppInvite from "../components/provider/UniversalWhatsAppInvite";
import { useProviderProfile } from "../services/providerService";

export default function ProviderWhatsAppQR() {
  const { data: profile, loading, error } = useProviderProfile();

  if (loading) {
    return <p className="p-6 text-gray-500">Cargando perfil…</p>;
  }
  if (error) {
    return <p className="p-6 text-red-500">Error: {error.message}</p>;
  }

  const businessPhoneE164 = profile?.telefono_contacto || "";

  return (
    <div className="page-wrapper px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">QR Universal de WhatsApp</h1>
      <p className="mb-6 text-sm text-gray-600">
        Imprime o comparte este QR para que tus clientes puedan iniciar
        conversación directa contigo vía WhatsApp.
      </p>

      <UniversalWhatsAppInvite
        businessPhoneE164={businessPhoneE164}
        presetText="RESERVAR"
      />
    </div>
  );
}
