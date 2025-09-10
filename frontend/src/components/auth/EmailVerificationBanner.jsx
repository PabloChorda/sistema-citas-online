// frontend/src/components/auth/EmailVerificationBanner.jsx
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { resendEmailVerification } from '../../services/authService';

export default function EmailVerificationBanner() {
  const { isAuthenticated, me, meLoading, refreshMe } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = me?.email ?? '';
  const autogen = useMemo(() => email && email.endsWith('@autogen.local'), [email]);

  // Decidir visibilidad según sesión, verificación y “Ocultar hasta…”
  useEffect(() => {
    if (meLoading) return;
    const dismissedUntil = Number(sessionStorage.getItem('email_verif_banner_hide_until') || '0');
    const shouldShow = isAuthenticated && !me?.email_verified && !autogen && Date.now() >= dismissedUntil;
    setVisible(!!shouldShow);
  }, [isAuthenticated, me?.email_verified, autogen, meLoading]);

  // Cuenta atrás para evitar spam de reenvíos
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => {
      setCooldown((s) => (s <= 1 ? (clearInterval(id), 0) : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onResend = async () => {
    setLoading(true);
    try {
      await resendEmailVerification();
      toast.success('Te hemos enviado un email de verificación.');
      setCooldown(30);
    } catch (e) {
      const msg = e?.message || '';
      // Si el backend dice que ya está verificado, refrescamos y ocultamos
      if (/ya est[áa] verificado/i.test(msg)) {
        try { await refreshMe(); } catch {}
        setVisible(false);
        toast.success('Tu correo ya estaba verificado.');
      } else {
        toast.error(msg || 'No se pudo enviar el correo ahora');
      }
    } finally {
      setLoading(false);
    }
  };

  const dismiss = (minutes = 120) => {
    const until = Date.now() + minutes * 60 * 1000;
    sessionStorage.setItem('email_verif_banner_hide_until', String(until));
    setVisible(false);
  };

  if (meLoading || !visible) return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Verifica tu correo</div>
          <div className="text-sm">
            Tu correo <span className="font-mono">{email || '—'}</span> aún no está verificado.
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
