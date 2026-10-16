/**
 * pingSession — ¿la cookie __session sigue siendo válida? (auth.ping, tRPC por cookie).
 *
 *   'open'    → hay sesión
 *   'closed'  → el back respondió 401: sesión cerrada, vencida o revocada
 *   'unknown' → red caída o 5xx: NO se asume nada (no se desloguea por un corte)
 */
export type PingResult = 'open' | 'closed' | 'unknown';

export async function pingSession(sassBackUrl: string): Promise<PingResult> {
  const base = sassBackUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  try {
    const res = await fetch(`${base}/api/v1/trpc/auth.ping`, { credentials: 'include' });
    if (res.status === 401) return 'closed';
    return res.ok ? 'open' : 'unknown';
  } catch {
    return 'unknown';
  }
}
