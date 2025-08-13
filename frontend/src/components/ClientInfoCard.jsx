import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { updateClientProfile } from '../services/clientService';
import { resendEmailVerification } from '../services/authService';
import Button from './ui/Button';
import Input from './ui/Input';

export default function ClientInfoCard({ profile, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    avatar_url: '',
  });

  // 🔒 bloquea email por defecto si está verificado
  const [emailLocked, setEmailLocked] = useState(!!profile?.email_verified);

  useEffect(() => {
    if (!profile) return;
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone_number: profile.phone_number || '',
      email: profile.email || '',
      avatar_url: profile.avatar_url || '',
    });
    setEmailLocked(!!profile.email_verified);
  }, [profile]);

  const isAutoEmail = formData.email?.endsWith?.('@autogen.local');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleCancel = () => {
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone_number: profile.phone_number || '',
      email: profile.email || '',
      avatar_url: profile.avatar_url || '',
    });
    setIsEditing(false);
    setError('');
    setEmailLocked(!!profile.email_verified);
  };

  const handleUnlockEmail = () => {
    const ok = window.confirm(
      'Cambiar el correo desverificará tu cuenta y te enviaremos un email para validarlo. ¿Quieres continuar?'
    );
    if (ok) setEmailLocked(false);
  };

  const handleResend = async () => {
    try {
      setResending(true);
      const res = await resendEmailVerification();
      toast.success(res?.msg || 'Email de verificación reenviado');
    } catch (err) {
      toast.error(err?.response?.data?.msg || err.message || 'No se pudo reenviar');
    } finally {
      setResending(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        first_name: formData.first_name?.trim(),
        last_name: formData.last_name?.trim(),
        phone_number: formData.phone_number?.trim(),
        email: formData.email?.trim(),
        avatar_url: formData.avatar_url?.trim(),
      };

      const res = await updateClientProfile(payload);
      const updatedUser = res?.user || res;

      onProfileUpdate?.(updatedUser);
      setIsEditing(false);
      setEmailLocked(!!updatedUser.email_verified);
      toast.success(res?.msg || 'Perfil actualizado');

      // aviso extra si cambió el correo
      if (profile?.email && payload.email && payload.email !== profile.email) {
        toast('Te enviamos un email para verificar el nuevo correo.', { icon: '📧' });
      }
    } catch (err) {
      setError(err?.response?.data?.msg || err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 text-left">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Mis Datos Personales</h3>
        {!isEditing && (
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {/* Avisos */}
      {isAutoEmail && (
        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Hemos creado un email temporal (<strong>{formData.email}</strong>) al entrar desde WhatsApp.
          Cambia tu correo por uno real para recibir confirmaciones.
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {/* Vista / Edición */}
      {!isEditing ? (
        <div className="space-y-2 text-sm text-gray-700">
          <p className="flex items-center gap-2">
            <strong className="inline-block w-48 text-gray-800">Email:</strong>
            <span>{profile.email}</span>
            {profile.email_verified ? (
              <span className="inline-block text-xs rounded bg-green-100 px-2 py-0.5 text-green-700">
                verificado
              </span>
            ) : (
              <span className="inline-block text-xs rounded bg-yellow-100 px-2 py-0.5 text-yellow-700">
                no verificado
              </span>
            )}
          </p>

          {!profile.email_verified && !isAutoEmail && (
            <div className="mt-2">
              <Button variant="outline" onClick={handleResend} disabled={resending}>
                {resending ? 'Enviando…' : 'Reenviar verificación'}
              </Button>
            </div>
          )}

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
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="text-sm">
            <span className="block mb-1 font-medium text-gray-700">Nombre</span>
            <Input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Tu nombre"
              required
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
              required
            />
          </label>

          {/* Email bloqueable */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              {emailLocked && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUnlockEmail}
                  className="ml-2"
                >
                  Cambiar correo
                </Button>
              )}
            </div>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="tucorreo@dominio.com"
              required
              readOnly={emailLocked}
              disabled={emailLocked}
            />
            {emailLocked ? (
              <span className="block mt-1 text-xs text-gray-500">
                Correo verificado. Pulsa <em>Cambiar correo</em> para editarlo.
              </span>
            ) : (
              <span className="block mt-1 text-xs text-gray-500">
                Cambiar el correo desverificará tu cuenta y te enviaremos un email para validarlo.
              </span>
            )}
          </div>

          <label className="text-sm md:col-span-2">
            <span className="block mb-1 font-medium text-gray-700">Teléfono</span>
            <Input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleInputChange}
              placeholder="+34 600 000 000"
            />
            <span className="block mt-1 text-xs text-gray-500">Usa formato internacional (+34…).</span>
          </label>

          {/* Acciones */}
          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button type="submit" disabled={isSaving} variant="primary">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button type="button" onClick={handleCancel} disabled={isSaving} variant="outline">
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

