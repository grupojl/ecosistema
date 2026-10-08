/**
 * lib/api-client.ts — realsass-dashboard-front
 *
 * Helpers de fetch HTTP para lo que NO está en el contrato tRPC de @real/trpc:
 *   - servicios fuera de este monorepo (campañas / pagos, ecosistema-ms)
 *   - services de dashboard que aún no migraron a trpc.* (store)
 * TODO ADR-005: migrar cada service a trpc.* y eliminar este archivo.
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

function sassBackUrl(): string {
  return trim(process.env['NEXT_PUBLIC_SASS_BACK_URL'] ?? process.env['NEXT_PUBLIC_REAL_BACK_URL']);
}

function ecommerceBackUrl(): string {
  return trim(process.env['NEXT_PUBLIC_ECOMMERCE_BACK_URL'] ?? process.env['NEXT_PUBLIC_ECOMMERCE_API_URL']);
}

/** Servicios externos que todavía se consumen por HTTP (sin AppRouter en @real/trpc). */
export type ExternalService = 'campanas' | 'pagos';

function externalUrl(service: ExternalService): string {
  const url = service === 'campanas'
    ? process.env['NEXT_PUBLIC_CAMPANAS_URL']
    : process.env['NEXT_PUBLIC_PAGOS_URL'];
  if (!url) {
    const name = service === 'campanas' ? 'NEXT_PUBLIC_CAMPANAS_URL' : 'NEXT_PUBLIC_PAGOS_URL';
    throw new Error(`[api-client] ${name} no definida`);
  }
  return trim(url);
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function doFetch<T>(
  method: Method,
  url:    string,
  body?:  unknown,
  orgId?: string,
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(orgId ? { 'x-organization-id': orgId } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`[api-client] ${method} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

function makeClient(baseUrl: () => string) {
  return {
    get:    <T>(path: string, orgId?: string)                => doFetch<T>('GET',    `${baseUrl()}${path}`, undefined, orgId),
    post:   <T>(path: string, body: unknown, orgId?: string) => doFetch<T>('POST',   `${baseUrl()}${path}`, body,      orgId),
    put:    <T>(path: string, body: unknown, orgId?: string) => doFetch<T>('PUT',    `${baseUrl()}${path}`, body,      orgId),
    patch:  <T>(path: string, body: unknown, orgId?: string) => doFetch<T>('PATCH',  `${baseUrl()}${path}`, body,      orgId),
    delete: <T>(path: string, orgId?: string)                => doFetch<T>('DELETE', `${baseUrl()}${path}`, undefined, orgId),
  };
}

/** Fetch autenticado contra sass-back (cookie __session). */
export const realBackFetch = makeClient(sassBackUrl);

/** Fetch autenticado contra ecommerce-back. */
export const ecommerceFetch = makeClient(ecommerceBackUrl);

/** Fetch contra servicios externos: apiClient.get('pagos', '/balance'). */
export const apiClient = {
  get:    <T>(service: ExternalService, path: string, orgId?: string)                => doFetch<T>('GET',    `${externalUrl(service)}${path}`, undefined, orgId),
  post:   <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('POST',   `${externalUrl(service)}${path}`, body,      orgId),
  put:    <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('PUT',    `${externalUrl(service)}${path}`, body,      orgId),
  patch:  <T>(service: ExternalService, path: string, body: unknown, orgId?: string) => doFetch<T>('PATCH',  `${externalUrl(service)}${path}`, body,      orgId),
  delete: <T>(service: ExternalService, path: string, orgId?: string)                => doFetch<T>('DELETE', `${externalUrl(service)}${path}`, undefined, orgId),
};
