// frontend/src/components/auth/VerifiedRoute.jsx
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resendEmailVerification } from '../../services/authService';

export default function VerifiedRoute() {
  const { isAuthenticated, me, meLoading, refreshMe } = useAuth();
  const location = useLocation();
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [err, setErr] = useState('');

  // 👇 Si no hay sesión, redirige (preservando next)
  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // 👇 Mientras AuthContext está resolviendo /auth/me, mostramos estado intermedio
  if (meLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">
          Comprobando verificación…
        </div>
      </div>
    );
  }

  // 👇 Si me aún no llegó por cualquier motivo, muestra algo seguro
  if (!me) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-sm text-slate-500">Cargando tu perfil…</div>
      </div>
    );
  }

  // 👇 Verificado: deja pasar a las rutas hijas
  if (me.email_verified) return <Outlet />;

  // Actions
  const onResend = async () => {
    setErr('');
    setSentOk(false);
    setSending(true);
    try {
      await resendEmailVerification();
      setSentOk(true);
    } catch (e) {
      setErr(e?.message || 'No se pudo enviar el correo. Inténtalo más tarde.');
    } finally {
      setSending(false);
    }
  };

  const onIAlreadyVerified = async () => {
    setErr('');
    try {
      await refreshMe(); // Si ahora está verificado, re-renderiza y muestra <Outlet/>
    } catch (e) {
      setErr(e?.message || 'No se pudo actualizar el estado de verificación.');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white shadow rounded-lg p-6 border">
      <h2 className="text-xl font-semibold text-gray-900">Verifica tu correo para continuar</h2>
      <p className="mt-2 text-sm text-gray-600">
        Tu cuenta (<span className="font-medium">{me.email || '—'}</span>) aún no está verificada.
        Hemos limitado el acceso a funciones de gestión hasta que confirmes tu email.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onResend}
          disabled={sending}
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {sending ? 'Enviando…' : 'Reenviar correo de verificación'}
        </button>

        <button
          type="button"
          onClick={onIAlreadyVerified}
          className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Ya verifiqué mi correo
        </button>

        {sentOk && (
          <span className="text-sm text-emerald-600">✅ Correo enviado. Revisa tu bandeja.</span>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}

      <p className="mt-4 text-xs text-gray-500">
        Consejo: si no lo ves, revisa la carpeta de spam o añade nuestro remitente a tu libreta de direcciones.
      </p>
    </div>
  );
}
