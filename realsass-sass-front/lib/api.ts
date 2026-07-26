// lib/api.ts
// ─── Cliente HTTP base + endpoints de Auth, Users, Organizations, Affiliates ──
import { getIdToken } from '@/lib/firebase'
import { AppError } from '@/lib/errors'
import type {
  UserProfile,
  Organization,
  AffiliateReferral,
  Collaborator,
  InvitationInfo,
  InviteCollaboratorPayload,
  CollaboratorPermissions,
} from '@/lib/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Petición autenticada con retry automático en 401.
 * - En el primer 401, fuerza refresh del token Firebase y reintenta una vez.
 * - Si el segundo intento también falla, lanza AppError con code AUTH.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const token = await getIdToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  // Token expirado → refresh y reintentar UNA vez
  if (res.status === 401 && _retry) {
    try {
      await getIdToken(true) // forceRefresh = true
      return apiFetch<T>(path, options, false)
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
    throw new AppError(message, 'UNKNOWN', res.status)
  }

  return res.json() as Promise<T>
}

/** Petición pública — sin token (para rutas como GET /invitations/:token) */
export async function apiFetchPublic<T>(path: string): Promise<T> {
  let res: Response

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new AppError('Sin conexión. Verificá tu red e intentá nuevamente.', 'NETWORK')
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {}
    try { body = await res.json() } catch { /* ignorar */ }
    const message = (body['message'] as string) ?? res.statusText
    if (res.status === 404) throw new AppError(message, 'NOT_FOUND', 404)
    throw new AppError(message, 'UNKNOWN', res.status)
  }

  return res.json() as Promise<T>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function syncUser(refCode?: string) {
  const qs = refCode ? `?ref=${encodeURIComponent(refCode)}` : ''
  return apiFetch<{ success: boolean; isNew: boolean; data: UserProfile }>(
    `/auth/sync${qs}`,
    { method: 'POST' },
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getMe() {
  return apiFetch<{ success: boolean; data: UserProfile }>('/users/me')
}

export async function selectRole(role: 'owner' | 'affiliate') {
  return apiFetch<{ success: boolean; message: string; data: UserProfile }>(
    '/users/select-role',
    { method: 'PATCH', body: JSON.stringify({ role }) },
  )
}

// ─── Organizations ────────────────────────────────────────────────────────────

export async function getMyOrganization() {
  return apiFetch<{ success: boolean; data: Organization }>('/organizations/me')
}

export async function updateMyOrganization(
  data: Partial<Omit<Organization, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
) {
  return apiFetch<{ success: boolean; message: string; data: Organization }>(
    '/organizations/me',
    { method: 'PATCH', body: JSON.stringify(data) },
  )
}

// ─── Affiliates ───────────────────────────────────────────────────────────────

export async function getMyAffiliateProfile() {
  return apiFetch<{
    success: boolean
    data: {
      affiliateCode: string
      balance: string
      referralCount: number
      createdAt: string
    }
  }>('/affiliates/me')
}

export async function getMyReferrals() {
  return apiFetch<{
    success: boolean
    data: {
      affiliateCode: string
      total: number
      referrals: AffiliateReferral[]
    }
  }>('/affiliates/me/referrals')
}

// ─── Collaborators (owner) ────────────────────────────────────────────────────

export async function listCollaborators() {
  return apiFetch<{ success: boolean; data: Collaborator[] }>(
    '/organizations/me/collaborators',
  )
}

export async function inviteCollaborator(payload: InviteCollaboratorPayload) {
  return apiFetch<{
    success: boolean
    message: string
    data: {
      collaborator: Collaborator
      inviteLink: string
      expiresAt: string
    }
  }>('/organizations/me/collaborators', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCollaboratorPermissions(
  collaboratorId: string,
  permissions: Partial<CollaboratorPermissions>,
) {
  return apiFetch<{ success: boolean; message: string; data: Collaborator }>(
    `/organizations/me/collaborators/${collaboratorId}`,
    { method: 'PATCH', body: JSON.stringify(permissions) },
  )
}

export async function removeCollaborator(collaboratorId: string) {
  return apiFetch<{ success: boolean; message: string }>(
    `/organizations/me/collaborators/${collaboratorId}`,
    { method: 'DELETE' },
  )
}

// ─── Invitations (colaborador) ────────────────────────────────────────────────

export async function getInvitationInfo(token: string) {
  return apiFetchPublic<{ success: boolean; data: InvitationInfo }>(
    `/invitations/${token}`,
  )
}

export async function acceptInvitation(token: string) {
  return apiFetch<{ success: boolean; message: string }>(
    `/invitations/${token}/accept`,
    { method: 'POST' },
  )
}

// ─── Re-export de tipos para conveniencia ────────────────────────────────────
export type { UserProfile }
