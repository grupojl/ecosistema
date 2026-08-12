// realsass-dashboard-front/lib/chat-ia-client.ts
//
// Cliente HTTP autenticado para chat-ia-back.
// Incluye el Firebase Bearer token + x-organization-id en cada request.
// La URL base viene de NEXT_PUBLIC_CHAT_IA_URL.
import { getIdToken } from '@real/auth-client';

const CHAT_IA_URL = process.env['NEXT_PUBLIC_CHAT_IA_URL'] ?? '';

export function buildQuery(params: Record<string, unknown>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

async function getHeaders(organizationId: string): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    'Content-Type':      'application/json',
    'Authorization':     `Bearer ${token}`,
    'x-organization-id': organizationId,
  };
}

export async function chatIaFetch<T>(
  path:           string,
  organizationId: string,
  options:        RequestInit = {},
): Promise<T> {
  const headers = await getHeaders(organizationId);

  const res = await fetch(`${CHAT_IA_URL}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status} — ${path}`);
  }

  return res.json() as Promise<T>;
}
