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
  /** Firebase verificó el email (Google/Apple sí; email+contraseña solo tras confirmarlo). Los clientes del storefront lo exigen. */
  readonly emailVerified?: boolean;
}

export interface OrganizationAccessResult {
  canAccess:       boolean;
  userId?:         string;
  organizationId?: string;
  role?:           TenantRole;
  permissions?:    Record<string, boolean>;
  reason?:         string;
}

const ROLES: readonly string[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

/** Valida la respuesta (JSON de otro servicio) de organization-access: no se confía en su forma, se comprueba. */
export function isOrganizationAccessResult(value: unknown): value is OrganizationAccessResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('canAccess' in value) || typeof value.canAccess !== 'boolean') return false;
  if ('role' in value && value.role !== undefined && !(typeof value.role === 'string' && ROLES.includes(value.role))) return false;
  if ('userId' in value && value.userId !== undefined && typeof value.userId !== 'string') return false;
  return true;
}
