// frontend/src/pages/LoginPhone.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { requestPhoneOtp, verifyPhoneOtp } from '../services/otpService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function LoginPhone() {
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const next = searchParams.get('next') || '/';

  const onRequest = async (e) => {
    e?.preventDefault?.();
    if (!phone.trim()) {
      toast.error('Introduce un teléfono válido');
      return;
    }
    setLoading(true);
    try {
      const res = await requestPhoneOtp(phone.trim());
      setStep('code');
      if (res?.debug_code) {
        setCode(res.debug_code); // <-- autocompleta el input
        toast.success(`Código enviado. (DEV: ${res.debug_code})`);
        // si viene verify=1 en la URL, auto-verificamos
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
    if (!code.trim()) {
      toast.error('Introduce el código que has recibido');
      return;
    }
    setLoading(true);
    try {
      const { profile_complete } = await verifyPhoneOtp(phone.trim(), code.trim());
      toast.success('Sesión iniciada');
      // IMPORTANTE: ruta correcta bajo el dashboard
      if (!profile_complete) {
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

  // Prefill + auto-enviar OTP si viene de la invitación
  useEffect(() => {
    const p = searchParams.get('phone');
    const auto = searchParams.get('send') === '1';
    if (p) {
      const decoded = (() => { try { return decodeURIComponent(p); } catch { return p; }})();
      setPhone(decoded);
      if (auto) {
        onRequest(); // envía OTP automáticamente
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow text-left">
        <h1 className="text-xl font-semibold mb-4">
          {step === 'phone' ? 'Entrar con tu teléfono' : 'Introduce el código'}
        </h1>

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
