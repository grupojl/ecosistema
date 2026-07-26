// lib/types.ts

// ─── Organization ─────────────────────────────────────────────────────────────
export interface Organization {
  id:          string
  userId:      string
  name:        string | null
  description: string | null
  logoUrl:     string | null
  website:     string | null
  phone:       string | null
  address:     string | null
  createdAt:   string
  updatedAt:   string
}

// ─── Tenant (org propia o colaboración) ──────────────────────────────────────
export type TenantRole = 'OWNER' | 'COLLABORATOR'

export interface TenantPermissions {
  canViewListings:        boolean
  canCreateListings:      boolean
  canEditListings:        boolean
  canDeleteListings:      boolean
  canViewStats:           boolean
  canManageLeads:         boolean
  canManageCollaborators: boolean
}

export interface Tenant {
  organizationId: string
  organization:   Organization
  role:           TenantRole
  permissions:    TenantPermissions
}

// ─── Affiliate ────────────────────────────────────────────────────────────────
export interface AffiliateData {
  id:            string
  userId:        string
  balance:       string
  referralCount: number
  createdAt:     string
  updatedAt:     string
}

export interface AffiliateReferral {
  id:          string
  email:       string
  isOwner:     boolean
  isAffiliate: boolean
  createdAt:   string
}

// ─── UserProfile (shape canónico del back) ────────────────────────────────────
export interface UserProfile {
  id:             string
  firebaseUid:    string
  email:          string
  displayName:    string | null
  avatarUrl:      string | null
  isOwner:        boolean
  isAffiliate:    boolean
  affiliateCode:  string | null
  referredByCode: string | null
  createdAt:      string
  updatedAt:      string
  // Org propia (acceso rápido)
  organization:   Organization | null
  // Todos los tenants: org propia + colaboraciones activas
  tenants:        Tenant[]
  affiliateData:  AffiliateData | null
}

// ─── Collaborators ────────────────────────────────────────────────────────────
export type CollaboratorStatus = 'PENDING' | 'ACTIVE' | 'REMOVED'

export interface CollaboratorPermissions {
  canViewListings:        boolean
  canCreateListings:      boolean
  canEditListings:        boolean
  canDeleteListings:      boolean
  canViewStats:           boolean
  canManageLeads:         boolean
  canManageCollaborators: boolean
}

export interface Collaborator extends CollaboratorPermissions {
  id:             string
  organizationId: string
  userId:         string | null
  email:          string
  status:         CollaboratorStatus
  invitedAt:      string
  acceptedAt:     string | null
  updatedAt:      string
  user:           { email: string; firebaseUid: string } | null
  invitation: {
    expiresAt: string
    usedAt:    string | null
    token:     string
  } | null
}

export interface InvitationInfo {
  email:        string
  organization: { id: string; name: string | null; logoUrl: string | null }
  expiresAt:    string
  permissions:  CollaboratorPermissions
}

export type InviteCollaboratorPayload = { email: string } & Partial<CollaboratorPermissions>

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getOwnerTenant(profile: UserProfile | null): Tenant | null {
  return profile?.tenants.find(t => t.role === 'OWNER') ?? null
}

export function getCollaboratorTenants(profile: UserProfile | null): Tenant[] {
  return profile?.tenants.filter(t => t.role === 'COLLABORATOR') ?? []
}
