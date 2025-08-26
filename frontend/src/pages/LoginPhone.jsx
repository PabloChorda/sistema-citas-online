// frontend/src/pages/LoginPhone.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { requestPhoneOtp, verifyPhoneOtp } from '../services/otpService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { getLastPhone, setLastPhone } from '../utils/phoneMemory';

// Util: decodifica el JWT (solo payload)
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return json || null;
  } catch {
    return null;
  }
}

export default function LoginPhone() {
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const next = searchParams.get('next') || '/';
  const inviteError = searchParams.get('error'); // p.ej. invalid_invite
  const autoSend = searchParams.get('send') === '1';

  const lastPhone = useMemo(() => getLastPhone() || '', []);

  // Guarda tokens/role en localStorage (ambas claves para compatibilidad)
  const persistAuth = (accessToken, refreshToken, role) => {
    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('accessToken', accessToken);
      const a = decodeJwt(accessToken);
      if (a?.exp) localStorage.setItem('access_exp', String(a.exp));
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('refreshToken', refreshToken);
      const r = decodeJwt(refreshToken);
      if (r?.exp) localStorage.setItem('refresh_exp', String(r.exp));
    }
    if (role) localStorage.setItem('userRole', role);
  };

  const onRequest = async (e) => {
    e?.preventDefault?.();
    const normalized = phone.trim();
    if (!normalized) {
      toast.error('Introduce un teléfono válido');
      return;
    }
    setLoading(true);
    try {
      const res = await requestPhoneOtp(normalized);

      // Guarda el último teléfono usado para UX
      setLastPhone(normalized);
      setStep('code');

      if (res?.debug_code) {
        // En dev, autocompleta el input para facilitar la prueba
        setCode(res.debug_code);
        toast.success(`Código enviado. (DEV: ${res.debug_code})`);

        // Si viene verify=1 en la URL y tenemos el code, auto-verificamos
        if (searchParams.get('verify') === '1') {
          await onVerify(); // llama sin evento
          return;
        }
      } else {
        toast.success('Código enviado por SMS/WhatsApp');
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e) => {
    e?.preventDefault?.();
    const normalized = phone.trim();

    if (!code.trim()) {
      toast.error('Introduce el código que has recibido');
      return;
    }
    setLoading(true);
    try {
      // ⬇️ IMPORTANTE: asegúrate de que tu backend devuelva también refresh_token y role
      // Respuesta esperada: { access_token, refresh_token, role, profile_complete, ... }
      const data = await verifyPhoneOtp(normalized, code.trim());

      // Persistimos sesión
      persistAuth(data.access_token, data.refresh_token, data.role);
      // Guardamos el teléfono tras verificar correctamente
      setLastPhone(normalized);

      toast.success('Sesión iniciada');

      // Redirección:
      // - Si el perfil no está completo, te mando al perfil cliente
      // - Si está completo, voy a "next" (o home) respetando el query param
      if (!data?.profile_complete) {
        navigate('/dashboard/client/profile', { replace: true });
      } else {
        navigate(next, { replace: true });
      }
    } catch (err) {
      const msg = err?.message || 'No se pudo verificar el código';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Prefill desde URL (?phone= + opcional send=1) o desde memoria local si no hay ?phone=
  useEffect(() => {
    const p = searchParams.get('phone');

    if (p) {
      const decoded = (() => {
        try { return decodeURIComponent(p); } catch { return p; }
      })();
      setPhone(decoded);
      if (autoSend) {
        // envía OTP automáticamente
        onRequest();
      }
    } else if (lastPhone) {
      // Si no viene en la URL, intentamos recuperar el último teléfono recordado
      setPhone(lastPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const useLastPhone = () => {
    if (lastPhone) setPhone(lastPhone);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow text-left">
        <h1 className="text-xl font-semibold mb-4">
          {step === 'phone' ? 'Entrar con tu teléfono' : 'Introduce el código'}
        </h1>

        {/* Aviso si la invitación está caducada o ya usada */}
        {inviteError === 'invalid_invite' && (
          <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Tu enlace ha caducado o ya fue usado. Introduce tu teléfono para pedir un nuevo código.
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={onRequest} className="space-y-4">
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-gray-700">Teléfono</span>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
              />
            </label>

            {/* Chip para reutilizar el último teléfono usado */}
            {!!lastPhone && lastPhone !== phone && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={useLastPhone}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 hover:bg-gray-50"
                >
                  Usar {lastPhone} otra vez
                </button>
              </div>
            )}

            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onVerify} className="space-y-4">
            <label className="text-sm block">
              <span className="block mb-1 font-medium text-gray-700">
                Código de verificación (6 dígitos)
              </span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
              />
            </label>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Verificando…' : 'Verificar y entrar'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep('phone')}
                disabled={loading}
              >
                Cambiar teléfono
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              ¿No te llegó? Vuelve atrás y pulsa “Enviar código” de nuevo pasado un momento.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
