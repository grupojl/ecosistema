import { getIdToken } from '../firebase/firebase';
import { AppError }   from '../errors/app-error';
import type { ApiEnvelope } from '../types/index';

// organizationId activo en memoria — no en localStorage
let _organizationId: string | null = null;

export function setActiveOrganizationId(id: string | null): void {
  _organizationId = id;
}

export function getActiveOrganizationId(): string | null {
  return _organizationId;
}

/**
 * apiFetch<T> — fetch autenticado del ecosistema.
 *
 * - Agrega Authorization: Bearer {idToken} automaticamente.
 * - Agrega x-organization-id si hay una org activa.
 * - En 401 hace force-refresh y reintenta UNA vez.
 * - Lanza AppError tipado.
 *
 * Sprint 2 (fila 2 — cookies HttpOnly):
 *   Agregar credentials: 'include' aqui — sin tocar ningun componente.
 */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return doFetch<T>(url, options, false);
}

async function doFetch<T>(url: string, options: RequestInit, isRetry: boolean): Promise<T> {
  let token: string;
  try {
    token = await getIdToken(isRetry);
  } catch {
    throw new AppError('AUTH', 'No hay sesion activa. Inicia sesion.');
  }

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (_organizationId) headers['x-organization-id'] = _organizationId;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new AppError('NETWORK', 'Sin conexion al servidor.');
  }

  if (res.status === 401 && !isRetry) return doFetch<T>(url, options, true);
  if (!res.ok) throw await buildAppError(res);

  const envelope = await res.json() as ApiEnvelope<T>;
  return envelope.data ?? (envelope as unknown as T);
}

async function buildAppError(res: Response): Promise<AppError> {
  let body: { message?: string } = {};
  try { body = await res.json(); } catch { /* sin body */ }
  const msg = body.message ?? `Error ${res.status}`;
  switch (res.status) {
    case 400: return new AppError('VALIDATION', msg);
    case 401: return new AppError('AUTH',       msg);
    case 403: return new AppError('FORBIDDEN',  msg);
    case 404: return new AppError('NOT_FOUND',  msg);
    case 409: return new AppError('CONFLICT',   msg);
    case 429: return new AppError('RATE_LIMIT', 'Demasiadas solicitudes. Espera un momento.');
    default:  return new AppError('SERVER',     msg);
  }
}
