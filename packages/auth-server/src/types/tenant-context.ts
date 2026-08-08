/**
 * TenantRole — jerarquia de roles.
 * DEBE coincidir con el enum MembershipRole del schema.prisma de sass-back.
 * El test de contrato en Sprint 2 lo verifica automaticamente.
 */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface TenantContext {
  readonly userId:         string;   // id interno (PK de users), NO el firebaseUid
  readonly organizationId: string;
  readonly role:           TenantRole;
  readonly permissions:    Readonly<Record<string, boolean>>;
}

export interface CurrentUserPayload {
  readonly uid:         string;
  readonly email:       string;
  readonly displayName: string | null;
  readonly avatarUrl:   string | null;
}

export interface OrganizationAccessResult {
  canAccess:       boolean;
  userId?:         string;
  organizationId?: string;
  role?:           TenantRole;
  permissions?:    Record<string, boolean>;
  reason?:         string;
}
