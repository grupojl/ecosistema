/**
 * entity-access.service.ts — permisos por ente (welver-domain.md §4, §15.4).
 *
 * Dos piezas:
 *  - `EntityAccessService.forActor()` arma un `EntityAccess` para una request: qué entes ve/edita/aprueba/publica quien
 *    llama. El dueño (OWNER) pasa siempre; un colaborador solo donde se le asignó (heredado por el subárbol).
 *  - `EntityPermissionsService` es la gestión de esos permisos (solo el dueño).
 */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { indexById, type TreeNode } from '@/welver/domain/org-tree';
import {
  allows,
  effectiveGrant,
  entityIdsAllowing,
  type EntityAction,
  type EntityGrant,
  type EffectiveGrant,
} from '@/welver/domain/entity-access';
import type { WelverActor } from '@/welver/welver.types';

const ACTION_LABEL: Record<EntityAction, string> = {
  view: 'ver',
  edit: 'editar',
  approve: 'aprobar',
  publish: 'publicar',
};

export class EntityAccess {
  constructor(
    readonly isOwner: boolean,
    private readonly nodes: ReadonlyMap<string, TreeNode>,
    private readonly grants: ReadonlyMap<string, EntityGrant>,
  ) {}

  exists(entityId: string): boolean {
    return this.nodes.has(entityId);
  }

  can(entityId: string, action: EntityAction): boolean {
    if (!this.nodes.has(entityId)) return false;
    return (
      this.isOwner ||
      allows(effectiveGrant(entityId, this.nodes, this.grants), action)
    );
  }

  /** Lanza NotFound si el ente no existe en la organización y Forbidden si existe pero no hay permiso. */
  assert(entityId: string, action: EntityAction): void {
    if (!this.nodes.has(entityId))
      throw new NotFoundException('Ente no encontrado');
    if (!this.can(entityId, action)) {
      throw new ForbiddenException(
        `No tenés permiso para ${ACTION_LABEL[action]} en este ente`,
      );
    }
  }

  /** Solo el dueño (estructura del organigrama, canales, claves…). */
  assertOwner(): void {
    if (!this.isOwner)
      throw new ForbiddenException(
        'Solo el administrador del municipio puede hacer esto',
      );
  }

  /** `null` = todos los entes. */
  idsAllowing(action: EntityAction): Set<string> | null {
    return this.isOwner
      ? null
      : entityIdsAllowing(action, this.nodes, this.grants);
  }

  permissionsFor(entityId: string): EffectiveGrant {
    if (this.isOwner)
      return { view: true, edit: true, approve: true, publish: true };
    return effectiveGrant(entityId, this.nodes, this.grants);
  }
}

@Injectable()
export class EntityAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async forActor(actor: WelverActor): Promise<EntityAccess> {
    const tenant = this.prisma.forTenant(actor.organizationId);
    const entities = await tenant.municipalEntity.findMany({
      select: { id: true, parentId: true },
    });
    const nodes = indexById(entities);
    if (actor.role === 'OWNER') return new EntityAccess(true, nodes, new Map());

    const collaborator = await tenant.collaborator.findFirst({
      where: { status: 'ACTIVE', user: { firebaseUid: actor.uid } },
      select: { id: true },
    });
    const rows = collaborator
      ? await tenant.entityPermission.findMany({
          where: { collaboratorId: collaborator.id },
        })
      : [];
    const grants = new Map<string, EntityGrant>(
      rows.map((r) => [r.entityId, r]),
    );
    return new EntityAccess(false, nodes, grants);
  }
}

export interface PermissionInput {
  canView?: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
  canPublish?: boolean;
}

@Injectable()
export class EntityPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, collaboratorId?: string) {
    return this.prisma.forTenant(organizationId).entityPermission.findMany({
      where: collaboratorId ? { collaboratorId } : {},
      orderBy: { createdAt: 'asc' },
    });
  }

  async set(
    organizationId: string,
    collaboratorId: string,
    entityId: string,
    input: PermissionInput,
  ) {
    const tenant = this.prisma.forTenant(organizationId);
    const [collaborator, entity] = await Promise.all([
      tenant.collaborator.findFirst({
        where: { id: collaboratorId },
        select: { id: true, status: true },
      }),
      tenant.municipalEntity.findFirst({
        where: { id: entityId },
        select: { id: true },
      }),
    ]);
    if (!collaborator || collaborator.status === 'REMOVED')
      throw new NotFoundException('Colaborador no encontrado');
    if (!entity) throw new NotFoundException('Ente no encontrado');

    const data = {
      ...(input.canView !== undefined && { canView: input.canView }),
      ...(input.canEdit !== undefined && { canEdit: input.canEdit }),
      ...(input.canApprove !== undefined && { canApprove: input.canApprove }),
      ...(input.canPublish !== undefined && { canPublish: input.canPublish }),
    };
    return tenant.entityPermission.upsert({
      where: { collaboratorId_entityId: { collaboratorId, entityId } },
      create: { organizationId, collaboratorId, entityId, ...data },
      update: data,
    });
  }

  async remove(
    organizationId: string,
    collaboratorId: string,
    entityId: string,
  ): Promise<{ removed: boolean }> {
    const { count } = await this.prisma
      .forTenant(organizationId)
      .entityPermission.deleteMany({ where: { collaboratorId, entityId } });
    return { removed: count > 0 };
  }
}
