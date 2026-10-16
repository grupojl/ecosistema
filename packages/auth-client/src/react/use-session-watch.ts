'use client';

/**
 * Sesión "en vivo" entre fronts (ADR-020 / flows §Paso 1).
 *
 * La cookie __session es compartida entre fronts, pero el navegador no avisa cuando cambia. Cada front
 * revalida cuando:
 *   · la pestaña vuelve a ser visible o recupera el foco (el caso normal: cambiás de un front al otro),
 *   · vuelve la conexión,
 *   · pasa el intervalo mientras la pestaña está visible,
 *   · otra pestaña del MISMO origen avisa (BroadcastChannel; los otros orígenes no pueden).
 */
import { useEffect, useRef } from 'react';

const CHANNEL_NAME = 'real-auth-session';
const MIN_GAP_MS   = 2_000;

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** Avisa a las otras pestañas de este origen que la sesión cambió (login o logout). */
export function notifySessionChange(): void {
  try { getChannel()?.postMessage('changed'); } catch { /* sin BroadcastChannel: queda el foco/intervalo */ }
}

export function useSessionWatch(revalidate: () => Promise<void> | void, intervalMs = 30_000): void {
  const latest = useRef(revalidate);
  latest.current = revalidate;

  useEffect(() => {
    let running = false;
    let lastRun = 0;

    const run = async () => {
      if (running || document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastRun < MIN_GAP_MS) return;
      lastRun = now;
      running = true;
      try { await latest.current(); } finally { running = false; }
    };

    const onVisible = () => { void run(); };
    const bc        = getChannel();
    const timer     = setInterval(() => { void run(); }, intervalMs);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    bc?.addEventListener('message', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      bc?.removeEventListener('message', onVisible);
    };
  }, [intervalMs]);
}
