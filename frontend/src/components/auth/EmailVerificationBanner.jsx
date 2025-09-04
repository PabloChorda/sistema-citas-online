// src/components/auth/EmailVerificationBanner.jsx
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { resendEmailVerification } from '../../services/authService';
import { getClientProfile } from '../../services/clientService';
import { getProviderProfile } from '../../services/providerService';

export default function EmailVerificationBanner() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Carga de estado (una sola vez): si email existe y no está verificado -> mostrar banner
  useEffect(() => {
    const dismissedUntil = Number(sessionStorage.getItem('email_verif_banner_hide_until') || '0');
    if (Date.now() < dismissedUntil) return;

    const role = localStorage.getItem('userRole');
    const load = async () => {
      try {
        let prof;
        if (role === 'client') {
          prof = await getClientProfile();
        } else if (role === 'provider') {
          prof = await getProviderProfile();
        } else {
          return; // sin rol, nada que mostrar
        }

        // Normalizamos posibles formas del objeto
        const e = prof?.email || prof?.user?.email || '';
        const verified = (prof?.email_verified ?? prof?.user?.email_verified) || false;
        const autogen = e && e.endsWith('@autogen.local');

        setEmail(e);
        setVisible(Boolean(e) && !autogen && !verified);
      } catch {
        // silencio: si no podemos cargar perfil, no molestamos
      }
    };

    load();
  }, []);

  // Cuenta atrás para el botón "Reenviar"
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => {
      setCooldown(s => (s <= 1 ? (clearInterval(id), 0) : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onResend = async () => {
    setLoading(true);
    try {
      await resendEmailVerification();
      toast.success('Te hemos enviado un email de verificación.');
      setCooldown(30); // evita spam durante 30s
    } catch (e) {
      toast.error(e?.message || 'No se pudo enviar el correo ahora');
    } finally {
      setLoading(false);
    }
  };

  const dismiss = (minutes = 120) => {
    const until = Date.now() + minutes * 60 * 1000;
    sessionStorage.setItem('email_verif_banner_hide_until', String(until));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Verifica tu correo</div>
          <div className="text-sm">
            Tu correo <span className="font-mono">{email}</span> aún no está verificado.
            Revisa tu bandeja de entrada o solicita un nuevo email.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResend}
            disabled={loading || cooldown > 0}
            className="rounded bg-amber-600 px-3 py-1.5 text-white text-sm disabled:opacity-60"
          >
            {cooldown > 0 ? `Reenviar (${cooldown})` : (loading ? 'Enviando…' : 'Reenviar')}
          </button>
          <button
            onClick={() => dismiss(120)}
            className="rounded border px-3 py-1.5 text-sm"
            aria-label="Ocultar recordatorio"
          >
            Ocultar
          </button>
        </div>
      </div>
    </div>
  );
}
