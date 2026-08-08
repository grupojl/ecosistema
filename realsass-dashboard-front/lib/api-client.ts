/**
 * lib/api-client.ts — dashboard-front
 *
 * Cliente HTTP autenticado para ecommerce-back y otros servicios.
 * Usa el Bearer token de Firebase via @real/auth-client.
 *
 * Exporta:
 *   ecommerceFetch  — para features/store (con x-organization-id)
 *   apiClient       — para features/pagos, features/chat, features/campanas
 *   buildQuery      — helper para query strings
 */
import { getIdToken } from '@real/auth-client';

const ECOMMERCE_URL = (process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? '').replace(/\/+$/, '');
const REAL_BACK_URL = (process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '').replace(/\/+$/, '');

// ─── Helper: buildQuery ───────────────────────────────────────────────────────

export function buildQuery(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

// ─── fetch autenticado base ───────────────────────────────────────────────────

async function authenticatedFetch<T>(
  url:     string,
  options: RequestInit = {},
  orgId?:  string,
): Promise<T> {
  let token: string;
  try {
    token = await getIdToken();
  } catch {
    throw new Error('No hay sesion activa');
  }

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (orgId) headers['x-organization-id'] = orgId;

  const res = await fetch(url, { ...options, headers });

  // Retry en 401
  if (res.status === 401) {
    const freshToken = await getIdToken(true);
    headers['Authorization'] = `Bearer ${freshToken}`;
    const retry = await fetch(url, { ...options, headers });
    if (!retry.ok) throw new Error(`Error ${retry.status}`);
    const envelope = await retry.json() as { data?: T };
    return (envelope.data ?? envelope) as T;
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const b = await res.json() as { message?: string }; msg = b.message ?? msg; } catch { /* noop */ }
    throw new Error(msg);
  }

  const envelope = await res.json() as { data?: T };
  return (envelope.data ?? envelope) as T;
}

// ─── ecommerceFetch — para features/store ────────────────────────────────────

export const ecommerceFetch = {
  get: <T>(path: string, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, { method: 'GET' }, orgId),

  post: <T>(path: string, body: unknown, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, {
      method: 'POST', body: JSON.stringify(body),
    }, orgId),

  patch: <T>(path: string, body: unknown, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }, orgId),

  delete: <T>(path: string, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, { method: 'DELETE' }, orgId),
};

// ─── apiClient — para features/pagos, chat, campanas ─────────────────────────
// El primer argumento 'servicio' es un string que por ahora se ignora
// (todos apuntan al mismo real-back). Se mantiene para compatibilidad.

export const apiClient = {
  get: <T>(_servicio: string, path: string) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, { method: 'GET' }),

  post: <T>(_servicio: string, path: string, body?: unknown) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, {
      method: 'POST', body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(_servicio: string, path: string, body: unknown) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  delete: <T>(_servicio: string, path: string) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, { method: 'DELETE' }),
};
