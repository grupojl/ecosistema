/**
 * lib/external-client.ts — realsass-dashboard-front
 *
 * Cliente HTTP SOLO para servicios que no son parte de este monorepo (ecosistema-ms): campañas y pagos.
 * Todo lo interno (sass-back, ecommerce-back) va por tRPC (ADR-005): no se agregan métodos para ellos acá.
 *
 * Es una de las excepciones documentadas de FETCH_ALLOWLIST (eslint.config.mjs).
 *
 * Auth: cookie HttpOnly (ADR-004) → credentials: 'include'.
 * Tenant: orgId opcional → header x-organization-id.
 */

export type QueryParams = Record<string, unknown>;

/** Serializa params ignorando undefined / null / ''. */
export function buildQuery(params: QueryParams = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, String(v));
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

const trim = (url: string | undefined): string => (url ?? '').replace(/\/+$/, '');

/** Servicios externos que se consumen por HTTP (no tienen AppRouter en @real/trpc). */
export type ExternalService = 'campanas' | 'pagos';

function externalUrl(service: ExternalService): string {
  const url = service === 'campanas'
    ? process.env['NEXT_PUBLIC_CAMPANAS_URL']
    : process.env['NEXT_PUBLIC_PAGOS_URL'];
  if (!url) {
    const name = service === 'campanas' ? 'NEXT_PUBLIC_CAMPANAS_URL' : 'NEXT_PUBLIC_PAGOS_URL';
    throw new Error(`[external-client] ${name} no definida`);
  }
  return trim(url);
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function doFetch<T>(method: Method, url: string, body?: unknown, orgId?: string): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(orgId ? { 'x-organization-id': orgId } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`[external-client] ${method} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** Fetch contra servicios externos: apiClient.get('pagos', '/balance'). */
export const apiClient = {
  get:    <T>(service: ExternalService, path: string, orgId?: string)                => doFetch<T>('GET',    `${externalUrl(service)}${path}`, undefined, orgId),
  post:   <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('POST',   `${externalUrl(service)}${path}`, body,      orgId),
  put:    <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('PUT',    `${externalUrl(service)}${path}`, body,      orgId),
  patch:  <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('PATCH',  `${externalUrl(service)}${path}`, body,      orgId),
  delete: <T>(service: ExternalService, path: string, orgId?: string)                => doFetch<T>('DELETE', `${externalUrl(service)}${path}`, undefined, orgId),
};
