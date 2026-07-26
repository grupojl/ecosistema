// lib/config-api.ts
// ─── Cliente HTTP autenticado hacia real-config-back ─────────────────────────
//
// A diferencia de lib/api.ts (real-back, donde la organización se resuelve
// implícitamente desde el usuario autenticado), real-config-back exige el
// header `x-organization-id` en cada request — su TenantGuard consulta a
// real-back (GET /auth/organization-access) para resolver rol/permisos de
// ese usuario en esa organización puntual.

import { getIdToken } from '@/lib/firebase'
import { AppError } from '@/lib/errors'
import type { TenantPermissions, TenantRole } from '@/lib/types'

const CONFIG_BASE_URL = process.env.NEXT_PUBLIC_CONFIG_API_URL ?? 'http://localhost:3001'

/**
 * Petición autenticada a real-config-back.
 * - Envía Authorization: Bearer <firebaseToken> + x-organization-id.
 * - En el primer 401, fuerza refresh del token Firebase y reintenta una vez
 *   (mismo patrón que apiFetch en lib/api.ts).
 */
export async function configApiFetch<T>(
  path: string,
  organizationId: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  if (!organizationId) {
    throw new AppError('organizationId requerido para llamar a config-service', 'VALIDATION', 400)
  }

  const token = await getIdToken()

  const res = await fetch(`${CONFIG_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
      ...options.headers,
    },
  })

  if (res.status === 401 && _retry) {
    try {
      await getIdToken(true) // forceRefresh = true
      return configApiFetch<T>(path, organizationId, options, false)
    } catch {
      throw new AppError('Sesión expirada. Por favor iniciá sesión nuevamente.', 'AUTH', 401)
    }
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {}
    try { body = await res.json() } catch { /* ignorar */ }

    const message = (body['message'] as string) ?? res.statusText

    if (res.status === 403) throw new AppError(message, 'FORBIDDEN', 403)
    if (res.status === 404) throw new AppError(message, 'NOT_FOUND', 404)
    if (res.status === 422) throw new AppError(message, 'VALIDATION', 422)
    if (res.status === 503) throw new AppError(message, 'NETWORK', 503)
    throw new AppError(message, 'UNKNOWN', res.status)
  }

  // Las respuestas de config-service vienen como { data: T, ... } o
  // { success: true, data: T } según el endpoint — ambas tienen `.data`.
  const body = (await res.json()) as { data: T }
  return body.data
}

// ─── Tipos (subset de prisma/schema.prisma de real-config-back) ─────────────

export interface FeatureFlag {
  id:                string
  key:               string
  enabled:           boolean
  description:       string | null
  systemTarget:      string
  rolloutPercentage: number
}

export interface QuotaConfig {
  id:             string
  resource:       string
  limit:          number // -1 = ilimitado
  currentUsage:   number
  alertAt:        number
  resetAt:        string | null
}

export interface ThemeConfig {
  id:              string
  name:            string
  isActive:        boolean
  isSystemDefault: boolean
  primaryColor:    string
  secondaryColor:  string
  accentColor:     string | null
  fontFamily:      string
  borderRadius:    string
  logoUrl:         string | null
  faviconUrl:      string | null
  darkMode:        boolean
}

export interface ContentTemplate {
  id:           string
  key:          string
  name:         string
  category:     string
  systemTarget: string
  variables:    string[]
}

export interface WebhookEndpoint {
  id:              string
  url:             string
  events:          string[]
  isActive:        boolean
  description:     string | null
  lastTriggeredAt: string | null
  failureCount:    number
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

/** GET /config/flags — cualquier miembro (OWNER o COLLABORATOR) */
export function getFeatureFlags(organizationId: string): Promise<FeatureFlag[]> {
  return configApiFetch<FeatureFlag[]>('/config/flags', organizationId)
}

/** PATCH /config/flags/:key — cualquier miembro */
export function updateFeatureFlag(
  organizationId: string,
  key: string,
  enabled: boolean,
): Promise<FeatureFlag> {
  return configApiFetch<FeatureFlag>(`/config/flags/${key}`, organizationId, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

// ─── Quotas ───────────────────────────────────────────────────────────────────

/** GET /config/quotas — cualquier miembro */
export function getQuotas(organizationId: string): Promise<QuotaConfig[]> {
  return configApiFetch<QuotaConfig[]>('/config/quotas', organizationId)
}

/** PATCH /config/quotas/:resource — solo OWNER */
export function updateQuotaLimit(
  organizationId: string,
  resource: string,
  limit: number,
): Promise<QuotaConfig> {
  return configApiFetch<QuotaConfig>(`/config/quotas/${resource}`, organizationId, {
    method: 'PATCH',
    body: JSON.stringify({ limit }),
  })
}

// ─── Temas ────────────────────────────────────────────────────────────────────

/** GET /config/themes — cualquier miembro */
export function getThemes(organizationId: string): Promise<ThemeConfig[]> {
  return configApiFetch<ThemeConfig[]>('/config/themes', organizationId)
}

/** PATCH /config/themes/:id/activate — cualquier miembro */
export function activateTheme(organizationId: string, id: string): Promise<ThemeConfig> {
  return configApiFetch<ThemeConfig>(`/config/themes/${id}/activate`, organizationId, {
    method: 'PATCH',
  })
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

/** GET /config/templates — cualquier miembro */
export function getTemplates(organizationId: string): Promise<ContentTemplate[]> {
  return configApiFetch<ContentTemplate[]>('/config/templates', organizationId)
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

/** GET /config/webhooks — cualquier miembro */
export function getWebhooks(organizationId: string): Promise<WebhookEndpoint[]> {
  return configApiFetch<WebhookEndpoint[]>('/config/webhooks', organizationId)
}

export type { TenantRole, TenantPermissions }
