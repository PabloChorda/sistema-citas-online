// src/components/auth/TokenBadge.jsx
import { useEffect, useState } from 'react';

// Util: decodifica payload del JWT
function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) || null;
  } catch {
    return null;
  }
}

export default function TokenBadge({ skew = 0 }) {
  const isDev = import.meta.env.MODE === 'development';
  const qsOn = typeof window !== 'undefined' && /\bdebugToken=1\b/.test(window.location.search);

  const [visible, setVisible] = useState(() => {
    if (!isDev) return false;
    if (qsOn) {
      try { localStorage.setItem('DEBUG_TOKEN_BADGE', '1'); } catch {}
      return true;
    }
    try {
      return localStorage.getItem('DEBUG_TOKEN_BADGE') === '1';
    } catch {
      return false;
    }
  });

  const [leftAccess, setLeftAccess] = useState(null);
  const [leftRefresh, setLeftRefresh] = useState(null);

  // Tecla rápida: Ctrl/Cmd + Alt + T
  useEffect(() => {
    if (!isDev) return;
    const onKey = (e) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (cmdOrCtrl && e.altKey && (e.key === 't' || e.key === 'T')) {
        const next = !visible;
        setVisible(next);
        try { localStorage.setItem('DEBUG_TOKEN_BADGE', next ? '1' : '0'); } catch {}
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, isDev]);

  // Contadores (solo si visible)
  useEffect(() => {
    if (!isDev || !visible) return;
    const tick = () => {
      const at = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
      const rt = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
      const now = Math.floor(Date.now() / 1000);
      const ax = decodeJwt(at)?.exp ?? 0;
      const rx = decodeJwt(rt)?.exp ?? 0;
      setLeftAccess(ax ? Math.max(0, ax - now - skew) : null);
      setLeftRefresh(rx ? Math.max(0, rx - now - skew) : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isDev, visible, skew]);

  if (!isDev || !visible) return null;

  const fmt = (n) => {
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const critical = (leftAccess ?? 0) <= 120;

  return (
    <span
      className={
        'ml-2 inline-flex items-center gap-2 rounded px-2 py-0.5 text-xs ' +
        (critical ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')
      }
      title="Token timers (Ctrl/Cmd + Alt + T para mostrar/ocultar)"
    >
      {leftAccess != null && <>Access&nbsp;{fmt(leftAccess)}</>}
      {leftRefresh != null && <>&nbsp;·&nbsp;Refresh&nbsp;{fmt(leftRefresh)}</>}
    </span>
  );
}
