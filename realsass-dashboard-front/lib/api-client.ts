// lib/api-client.ts
// Helpers HTTP hacia realsass-sass-back y realsass-ecommerce-back.
// Retry automático en 401: forceRefresh del token Firebase + un reintento.

import { getCurrentUserToken } from './firebase';

function getRealBackBase(): string {
  const url = process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '';
  if (!url) throw new Error('NEXT_PUBLIC_REAL_BACK_URL no configurado');
  return url.replace(/\/+$/, '');
}

function getEcommerceBase(): string {
  const url = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? '';
  if (!url) throw new Error('NEXT_PUBLIC_ECOMMERCE_API_URL no configurado');
  return url.replace(/\/+$/, '');
}

export function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function getToken(forceRefresh = false): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  try { return await getCurrentUserToken(forceRefresh); }
  catch { return undefined; }
}

interface FetchOptions {
  method?:   string;
  body?:     unknown;
  orgId?:    string;
  signal?:   AbortSignal;
  _isRetry?: boolean;
}

async function coreFetch<T>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, orgId, signal, _isRetry = false }: FetchOptions = {},
): Promise<T> {
  const token = await getToken(_isRetry);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId  ? { 'x-organization-id': orgId }      : {}),
  };

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Un solo retry con token fresco en el primer 401
  if (res.status === 401 && !_isRetry) {
    return coreFetch<T>(baseUrl, path, { method, body, orgId, signal, _isRetry: true });
  }

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (json['message'] as string | undefined) ??
      (json['error']   as string | undefined) ??
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return (json['data'] as T | undefined) ?? json as unknown as T;
}

// ─── realsass-sass-back (identidad + org + config) ────────────────────────────
export const realBackFetch = {
  get:    <T>(path: string, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { orgId }),
  post:   <T>(path: string, body: unknown, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'POST', body, orgId }),
  patch:  <T>(path: string, body: unknown, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'PATCH', body, orgId }),
  delete: <T>(path: string, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'DELETE', orgId }),
};

// ─── realsass-ecommerce-back (CMS productos + pedidos) ────────────────────────
export const ecommerceFetch = {
  get:    <T>(path: string, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { orgId }),
  post:   <T>(path: string, body: unknown, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'POST', body, orgId }),
  patch:  <T>(path: string, body: unknown, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'PATCH', body, orgId }),
  delete: <T>(path: string, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'DELETE', orgId }),
};
