/**
 * Tipos locales para OrganizationsClientService.
 * Alineados con el contrato de GET /api/v1/auth/organization-access en sass-back.
 */
import type { TenantRole } from '@real/auth-server';

export type { TenantRole };

export interface OrganizationAccessResult {
  canAccess:       boolean;
  userId?:         string;
  organizationId?: string;
  role?:           TenantRole;
  permissions?:    Record<string, boolean>;
  reason?:         string;
}
