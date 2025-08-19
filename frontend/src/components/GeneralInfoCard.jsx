// frontend/src/components/GeneralInfoCard.jsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { updateProviderProfile } from "../services/providerService";
import Button from "./ui/Button";

// Normaliza algo tipo "666555333" → "+34666555333" (heurística para ES)
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

// Valida: solo dígitos con opcional '+' inicial y entre 9 y 15 dígitos
function isPhoneValid(value) {
  if (!value) return false;
  const v = String(value).trim();
  return /^\+?\d{9,15}$/.test(v);
}

export default function GeneralInfoCard({ profile, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre_comercial: profile.nombre_comercial || "",
    telefono_contacto: profile.telefono_contacto || "",
    web: profile.web || "",
    bio: profile.bio || "",
    email_contacto: profile.email_contacto || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const phoneValid = useMemo(
    () => isPhoneValid(formData.telefono_contacto || ""),
    [formData.telefono_contacto]
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleCancel = () => {
    setFormData({
      nombre_comercial: profile.nombre_comercial || "",
      telefono_contacto: profile.telefono_contacto || "",
      web: profile.web || "",
      bio: profile.bio || "",
      email_contacto: profile.email_contacto || "",
    });
    setIsEditing(false);
    setError("");
  };

  const handleSave = async () => {
    setError("");

    // Validación previa
    if (formData.telefono_contacto && !phoneValid) {
      setError(
        "El WhatsApp de negocio no es válido. Debe tener entre 9 y 15 dígitos y solo números con un '+' opcional al inicio."
      );
      return;
    }

    setIsSaving(true);
    try {
      // Normaliza el teléfono antes de enviar
      const payload = {
        ...formData,
        telefono_contacto: formData.telefono_contacto
          ? normalizeE164Loose(formData.telefono_contacto)
          : "",
      };
      const updatedData = await updateProviderProfile(payload);
      onProfileUpdate(updatedData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error al guardar el perfil:", error);
      setError(`Error al guardar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Información General</h3>
        {!isEditing ? (
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/provider/whatsapp-qr"
              className="hidden sm:inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm border bg-white text-gray-800 hover:bg-gray-50 border-gray-300"
            >
              Gestionar QR →
            </Link>
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || (formData.telefono_contacto && !phoneValid)}
              variant="primary"
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
            <Button onClick={handleCancel} disabled={isSaving} variant="secondary">
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Vista o edición */}
      {!isEditing ? (
        <div className="grid gap-3 text-sm text-gray-700">
          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Email de cuenta:</span>
            <span>{profile.email}</span>
          </div>

          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Nombre comercial:</span>
            <span>{profile.nombre_comercial}</span>
          </div>

          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Email de contacto:</span>
            <span>{profile.email_contacto || "No especificado"}</span>
          </div>

          {/* WhatsApp de negocio (persistimos en telefono_contacto) */}
          <div className="flex items-start">
            <span className="font-medium w-48 text-left">WhatsApp de negocio:</span>
            <span>
              {profile.telefono_contacto || (
                <span className="text-amber-700">
                  No especificado —{" "}
                  <Link
                    to="/dashboard/provider/whatsapp-qr"
                    className="font-semibold underline hover:no-underline"
                  >
                    configúralo para generar el QR
                  </Link>
                </span>
              )}
            </span>
          </div>

          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Página web:</span>
            {profile.web ? (
              <a
                href={profile.web}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline"
              >
                {profile.web}
              </a>
            ) : (
              <span>No especificada</span>
            )}
          </div>

          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Biografía:</span>
            <span className="whitespace-pre-line">{profile.bio || "No especificada"}</span>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="text-sm text-left">
            Nombre comercial:
            <input
              type="text"
              name="nombre_comercial"
              value={formData.nombre_comercial}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
          </label>

          <label className="text-sm text-left">
            Email de contacto:
            <input
              type="email"
              name="email_contacto"
              value={formData.email_contacto}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
          </label>

          {/* WhatsApp de negocio */}
          <label className="text-sm text-left">
            WhatsApp de negocio:
            <input
              type="tel"
              name="telefono_contacto"
              value={formData.telefono_contacto}
              onChange={handleInputChange}
              onBlur={(e) =>
                setFormData((p) => ({
                  ...p,
                  telefono_contacto: normalizeE164Loose(e.target.value),
                }))
              }
              placeholder="+34666111222"
              className={`mt-1 block w-full rounded-lg border p-2 ${
                formData.telefono_contacto && !phoneValid
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300"
              }`}
            />
            {!formData.telefono_contacto ? (
              <p className="mt-1 text-xs text-gray-500">
                Acepta formatos como <code>666111222</code> (se guardará como{" "}
                <code>+34666111222</code>) o introduce directamente un número
                internacional con <code>+</code>.
              </p>
            ) : !phoneValid ? (
              <p className="mt-1 text-xs text-red-500">
                El número debe tener entre 9 y 15 dígitos y solo puede contener números o un{" "}
                <code>+</code> al inicio.
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-600">Formato válido.</p>
            )}
          </label>

          <label className="text-sm text-left">
            Página web:
            <input
              type="url"
              name="web"
              placeholder="https://ejemplo.com"
              value={formData.web}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
          </label>

          <label className="text-sm text-left">
            Biografía:
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows="4"
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            ></textarea>
          </label>

          {/* CTA para gestionar el QR desde perfil */}
          <div className="flex justify-end">
            <Link
              to="/dashboard/provider/whatsapp-qr"
              className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm border bg-white text-gray-800 hover:bg-gray-50 border-gray-300"
            >
              Gestionar QR →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
