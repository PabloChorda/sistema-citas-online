// frontend/src/components/ClientInfoCard.jsx
import { useState } from 'react';
import { updateClientProfile } from '../services/clientService';
import Button from './ui/Button';
import Input from './ui/Input';

export default function ClientInfoCard({ profile, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    phone_number: profile.phone_number || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone_number: profile.phone_number || '',
    });
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const updated = await updateClientProfile(formData);
      onProfileUpdate?.(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Error al guardar el perfil:', err);
      setError(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 text-left">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Mis Datos Personales</h3>
        {!isEditing ? (
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} variant="primary">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button onClick={handleCancel} disabled={isSaving} variant="outline">
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {/* View / Edit */}
      {!isEditing ? (
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong className="inline-block w-48 text-gray-800">Email:</strong>
            {profile.email}
          </p>
          <p>
            <strong className="inline-block w-48 text-gray-800">Nombre:</strong>
            {profile.first_name || 'No especificado'}
          </p>
          <p>
            <strong className="inline-block w-48 text-gray-800">Apellidos:</strong>
            {profile.last_name || 'No especificado'}
          </p>
          <p>
            <strong className="inline-block w-48 text-gray-800">Teléfono:</strong>
            {profile.phone_number || 'No especificado'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-gray-700">Nombre</span>
            <Input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Tu nombre"
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 font-medium text-gray-700">Apellidos</span>
            <Input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              placeholder="Tus apellidos"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="block mb-1 font-medium text-gray-700">Teléfono</span>
            <Input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleInputChange}
              placeholder="+34 600 000 000"
            />
          </label>

          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving} variant="primary">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button onClick={handleCancel} disabled={isSaving} variant="outline">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
