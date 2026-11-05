/**
 * entity-access.ts — permisos por ente (welver-domain.md §4 y §15.4: «ver, editar, aprobar y publicar»).
 *
 * Dominio puro. Un permiso concedido sobre un ente vale también para sus descendientes («Salud» incluye sus áreas);
 * si un descendiente tiene su propio permiso, ese manda (el más cercano gana). El dueño (OWNER) pasa siempre y no
 * se evalúa acá. Quien edita, aprueba o publica también puede ver.
 */
import { ancestorsOf, type TreeNode } from '@/welver/domain/org-tree';

export type EntityAction = 'view' | 'edit' | 'approve' | 'publish';

export interface EntityGrant {
  entityId: string;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canPublish: boolean;
}

export interface EffectiveGrant {
  view: boolean;
  edit: boolean;
  approve: boolean;
  publish: boolean;
}

const NONE: EffectiveGrant = {
  view: false,
  edit: false,
  approve: false,
  publish: false,
};

export function normalizeGrant(grant: EntityGrant): EffectiveGrant {
  const elevated = grant.canEdit || grant.canApprove || grant.canPublish;
  return {
    view: grant.canView || elevated,
    edit: grant.canEdit,
    approve: grant.canApprove,
    publish: grant.canPublish,
  };
}

/** Permiso efectivo de un colaborador sobre `entityId`: el del ente o, si no tiene, el del ancestro más cercano. */
export function effectiveGrant(
  entityId: string,
  nodes: ReadonlyMap<string, TreeNode>,
  grants: ReadonlyMap<string, EntityGrant>,
): EffectiveGrant {
  const own = grants.get(entityId);
  if (own) return normalizeGrant(own);
  for (const ancestor of ancestorsOf(entityId, nodes)) {
    const inherited = grants.get(ancestor);
    if (inherited) return normalizeGrant(inherited);
  }
  return NONE;
}

export function allows(grant: EffectiveGrant, action: EntityAction): boolean {
  return grant[action];
}

/** Ids de entes sobre los que el colaborador puede `action`. */
export function entityIdsAllowing(
  action: EntityAction,
  nodes: ReadonlyMap<string, TreeNode>,
  grants: ReadonlyMap<string, EntityGrant>,
): Set<string> {
  const result = new Set<string>();
  for (const id of nodes.keys()) {
    if (allows(effectiveGrant(id, nodes, grants), action)) result.add(id);
  }
  return result;
}
