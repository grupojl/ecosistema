/**
 * Contrato compartido con sistemas externos (config, chat-ia, pasarela-pagos, etc.)
 * Resuelve si un usuario (por firebaseUid) tiene acceso a una organización
 * (por id) y con qué rol/permisos. real-back es la única fuente de verdad.
 *
 * IMPORTANTE: este tipo está duplicado intencionalmente en real-config-back
 * (src/organizations-client/types/organization-access.types.ts) como contrato
 * de API. Si cambia acá, debe actualizarse también allí. Candidato a ADR:
 * extraer a un paquete npm compartido (@real/contracts) si aparece un tercer
 * consumidor.
 */

export type TenantRole = 'OWNER' | 'COLLABORATOR';

export interface CollaboratorPermissions {
  canViewListings: boolean;
  canCreateListings: boolean;
  canEditListings: boolean;
  canDeleteListings: boolean;
  canViewStats: boolean;
  canManageLeads: boolean;
  canManageCollaborators: boolean;
}

export const FULL_COLLABORATOR_PERMISSIONS: CollaboratorPermissions = {
  canViewListings: true,
  canCreateListings: true,
  canEditListings: true,
  canDeleteListings: true,
  canViewStats: true,
  canManageLeads: true,
  canManageCollaborators: true,
};

export interface OrganizationAccessResult {
  canAccess: boolean;
  userId?: string;
  organizationId?: string;
  role?: TenantRole;
  permissions?: CollaboratorPermissions;
  reason?: string;
}
