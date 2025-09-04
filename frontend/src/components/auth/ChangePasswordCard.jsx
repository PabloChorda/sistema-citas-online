//src/components/auth/ChangePasswordCard.js
import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { changePassword } from '../../services/authService';
import toast from 'react-hot-toast';

export default function ChangePasswordCard() {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!newPwd || newPwd.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPwd, newPwd);
      toast.success('Contraseña actualizada');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      toast.error(err?.message || 'No se pudo actualizar la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-gray-800">Cambiar contraseña</h3>
      <p className="text-sm text-gray-500 mb-3">
        Establece una nueva contraseña para tu cuenta.
      </p>
      <form onSubmit={onSubmit} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
          <Input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="••••••••"
            disabled={submitting}
          />
          <p className="text-xs text-gray-400 mt-1">
            Si entraste con Google o teléfono y nunca definiste una contraseña, deja este campo vacío.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
          <Input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Mín. 8 caracteres"
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
          <Input
            type="password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Repite la nueva contraseña"
            required
            disabled={submitting}
          />
        </div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Actualizar contraseña'}
        </Button>
      </form>
    </section>
  );
}
