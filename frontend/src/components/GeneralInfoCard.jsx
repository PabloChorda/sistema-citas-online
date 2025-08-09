// frontend/src/components/GeneralInfoCard.jsx
import { useState } from "react";
import { updateProviderProfile } from "../services/providerService";
import Button from "./ui/Button";

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
    setIsSaving(true);
    setError("");
    try {
      const updatedData = await updateProviderProfile(formData);
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
          <Button variant="secondary" onClick={() => setIsEditing(true)}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} variant="primary">
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
          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Teléfono de contacto:</span>
            <span>{profile.telefono_contacto || "No especificado"}</span>
          </div>
          <div className="flex items-start">
            <span className="font-medium w-48 text-left">Página web:</span>
            {profile.web ? (
              <a href={profile.web} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline">
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
          <label className="text-sm text-left">
            Teléfono de contacto:
            <input
              type="tel"
              name="telefono_contacto"
              value={formData.telefono_contacto}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
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
        </div>
      )}
    </div>
  );
}
