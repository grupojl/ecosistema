/**
 * org-chart.service.ts — organigrama del municipio (welver-domain.md §13.2 «Organigrama y datos»).
 *
 * Árbol con un solo padre por ente, sin límite duro de profundidad (se avisa pasados 5 niveles) y vínculos
 * transversales para programas compartidos. Los entes NUNCA se borran: se archivan (con su subárbol), porque canales,
 * permisos y versiones de conocimiento cuelgan de sus ids.
 *
 * Permisos: la estructura (mover, archivar, aprobación, vínculos de otros) es del dueño; un colaborador con «editar»
 * en un ente puede renombrarlo, describirlo y crearle hijos.
 */
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma';
import {
  EntityAccessService,
  type EntityAccess,
} from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  SUGGESTED_MAX_DEPTH,
  descendantsOf,
  flattenTree,
  indexById,
  siblingKey,
  depthOf,
  wouldCreateCycle,
} from '@/welver/domain/org-tree';
import {
  ORG_CHART_TEMPLATES,
  flattenTemplate,
  type TemplateKey,
} from '@/welver/domain/org-chart-templates';
import type { WelverActor } from '@/welver/welver.types';

export interface CreateEntityInput {
  name: string;
  description?: string;
  parentId?: string | null;
}

export interface UpdateEntityInput {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  /** Solo el dueño. */
  requiresApproval?: boolean;
  /** Solo el dueño. `null` = pasa a ser raíz. */
  parentId?: string | null;
}

export interface EntityPermissionsView {
  view: boolean;
  edit: boolean;
  approve: boolean;
  publish: boolean;
}

export interface EntityListItem {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  requiresApproval: boolean;
  archivedAt: Date | null;
  depth: number;
  path: string;
  exceedsSuggestedDepth: boolean;
  /** Lo que PUEDE hacer quien consulta (el servidor igual lo vuelve a exigir en cada acción). */
  permissions: EntityPermissionsView;
}

const ENTITY_SELECT = {
  id: true,
  parentId: true,
  name: true,
  description: true,
  sortOrder: true,
  requiresApproval: true,
  archivedAt: true,
} satisfies Prisma.MunicipalEntitySelect;

@Injectable()
export class OrgChartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** Entes que el actor puede ver, en orden de árbol (padres antes que hijos). */
  async list(
    actor: WelverActor,
    opts: { includeArchived?: boolean } = {},
  ): Promise<EntityListItem[]> {
    const [access, rows] = await Promise.all([
      this.access.forActor(actor),
      this.prisma
        .forTenant(actor.organizationId)
        .municipalEntity.findMany({ select: ENTITY_SELECT }),
    ]);
    const byId = indexById(rows);
    const visible = rows.filter(
      (r) =>
        (opts.includeArchived || r.archivedAt === null) &&
        access.can(r.id, 'view'),
    );
    const flat = flattenTree(
      visible,
      (n) => n.name,
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
    );
    return flat.map(({ node, path }) => {
      const depth = depthOf(node.id, byId);
      return {
        ...node,
        depth,
        path,
        exceedsSuggestedDepth: depth > SUGGESTED_MAX_DEPTH,
        permissions: access.permissionsFor(node.id),
      };
    });
  }

  async get(actor: WelverActor, id: string): Promise<EntityListItem> {
    const list = await this.list(actor, { includeArchived: true });
    const found = list.find((e) => e.id === id);
    if (!found) throw new NotFoundException('Ente no encontrado');
    return found;
  }

  async create(actor: WelverActor, input: CreateEntityInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    const parentId = input.parentId ?? null;
    if (parentId === null) access.assertOwner();
    else access.assert(parentId, 'edit');

    const tenant = this.prisma.forTenant(actor.organizationId);
    if (parentId !== null) {
      const parent = await tenant.municipalEntity.findFirst({
        where: { id: parentId },
        select: { archivedAt: true },
      });
      if (!parent) throw new NotFoundException('El ente padre no existe');
      if (parent.archivedAt)
        throw new BadRequestException(
          'No se puede crear dentro de un ente archivado',
        );
    }
    await this.assertNameFree(actor.organizationId, parentId, input.name);

    const last = await tenant.municipalEntity.aggregate({
      where: { parentId },
      _max: { sortOrder: true },
    });
    return tenant.municipalEntity.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        description: input.description ?? null,
        parentId,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: ENTITY_SELECT,
    });
  }

  async update(actor: WelverActor, id: string, input: UpdateEntityInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    access.assert(id, 'edit');
    if (input.requiresApproval !== undefined || input.parentId !== undefined)
      access.assertOwner();

    const tenant = this.prisma.forTenant(actor.organizationId);
    const current = await tenant.municipalEntity.findFirst({
      where: { id },
      select: ENTITY_SELECT,
    });
    if (!current) throw new NotFoundException('Ente no encontrado');

    const nextParentId =
      input.parentId === undefined ? current.parentId : input.parentId;
    if (input.parentId !== undefined && input.parentId !== current.parentId) {
      await this.assertCanMove(actor.organizationId, id, input.parentId);
    }
    const nextName = input.name ?? current.name;
    if (nextName !== current.name || nextParentId !== current.parentId) {
      await this.assertNameFree(
        actor.organizationId,
        nextParentId,
        nextName,
        id,
      );
    }

    return tenant.municipalEntity.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.requiresApproval !== undefined && {
          requiresApproval: input.requiresApproval,
        }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
      },
      select: ENTITY_SELECT,
    });
  }

  /** Archiva el ente y todo su subárbol, junto con sus datos de conocimiento (la IA deja de usarlos). */
  async archive(
    actor: WelverActor,
    id: string,
  ): Promise<{ archivedEntities: number }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    access.assertOwner();
    const tenant = this.prisma.forTenant(actor.organizationId);
    const all = await tenant.municipalEntity.findMany({
      select: { id: true, parentId: true },
    });
    if (!all.some((e) => e.id === id))
      throw new NotFoundException('Ente no encontrado');

    const ids = [id, ...descendantsOf(id, all)];
    const now = new Date();
    await tenant.$transaction([
      tenant.municipalEntity.updateMany({
        where: { id: { in: ids }, archivedAt: null },
        data: { archivedAt: now },
      }),
      tenant.knowledgeItem.updateMany({
        where: { entityId: { in: ids }, status: { not: 'ARCHIVED' } },
        data: { status: 'ARCHIVED', archivedAt: now },
      }),
      // Un canal de un ente archivado no puede seguir atendiendo.
      tenant.entityChannel.updateMany({
        where: {
          entityId: { in: ids },
          status: { in: ['CONNECTED', 'PENDING'] },
        },
        data: { status: 'PAUSED', pausedAt: now, pausedReason: 'MANUAL' },
      }),
    ]);
    return { archivedEntities: ids.length };
  }

  /** Reactiva UN ente archivado (no sus descendientes ni sus datos). Su padre tiene que estar activo. */
  async restore(actor: WelverActor, id: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    access.assertOwner();
    const tenant = this.prisma.forTenant(actor.organizationId);
    const entity = await tenant.municipalEntity.findFirst({
      where: { id },
      select: ENTITY_SELECT,
    });
    if (!entity) throw new NotFoundException('Ente no encontrado');
    if (!entity.archivedAt) return entity;
    if (entity.parentId) {
      const parent = await tenant.municipalEntity.findFirst({
        where: { id: entity.parentId },
        select: { archivedAt: true },
      });
      if (parent?.archivedAt)
        throw new BadRequestException('Restaurá primero el ente padre');
    }
    return tenant.municipalEntity.update({
      where: { id },
      data: { archivedAt: null },
      select: ENTITY_SELECT,
    });
  }

  // ── Vínculos transversales ────────────────────────────────────────────────

  async listLinks(actor: WelverActor) {
    const access = await this.access.forActor(actor);
    const links = await this.prisma
      .forTenant(actor.organizationId)
      .entityLink.findMany({ orderBy: { createdAt: 'asc' } });
    return links.filter(
      (l) =>
        access.can(l.fromEntityId, 'view') && access.can(l.toEntityId, 'view'),
    );
  }

  async link(
    actor: WelverActor,
    fromEntityId: string,
    toEntityId: string,
    label?: string,
  ) {
    await this.subscriptions.assertWritable(actor.organizationId);
    if (fromEntityId === toEntityId)
      throw new BadRequestException(
        'Un ente no puede vincularse consigo mismo',
      );
    const access = await this.access.forActor(actor);
    access.assert(fromEntityId, 'edit');
    if (!access.exists(toEntityId))
      throw new NotFoundException('El ente a vincular no existe');

    const tenant = this.prisma.forTenant(actor.organizationId);
    const existing = await tenant.entityLink.findFirst({
      where: {
        OR: [
          { fromEntityId, toEntityId },
          { fromEntityId: toEntityId, toEntityId: fromEntityId },
        ],
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Esos entes ya están vinculados');
    return tenant.entityLink.create({
      data: {
        organizationId: actor.organizationId,
        fromEntityId,
        toEntityId,
        label: label ?? null,
      },
    });
  }

  async unlink(
    actor: WelverActor,
    linkId: string,
  ): Promise<{ removed: boolean }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    const tenant = this.prisma.forTenant(actor.organizationId);
    const link = await tenant.entityLink.findFirst({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo no encontrado');
    const access = await this.access.forActor(actor);
    access.assert(link.fromEntityId, 'edit');
    await tenant.entityLink.delete({ where: { id: linkId } });
    return { removed: true };
  }

  // ── Plantillas ────────────────────────────────────────────────────────────

  /** Crea el organigrama inicial desde una plantilla. Solo si el municipio todavía no tiene entes. */
  async applyTemplate(
    actor: WelverActor,
    key: TemplateKey,
  ): Promise<{ created: number }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access: EntityAccess = await this.access.forActor(actor);
    access.assertOwner();
    const tenant = this.prisma.forTenant(actor.organizationId);
    if ((await tenant.municipalEntity.count()) > 0) {
      throw new ConflictException(
        'El organigrama ya tiene entes: la plantilla solo se aplica a uno vacío',
      );
    }
    const flat = flattenTemplate(ORG_CHART_TEMPLATES[key]);
    const ids = flat.map(() => randomUUID());
    // Padres antes que hijos (flattenTemplate lo garantiza): un único createMany respeta las claves foráneas.
    await tenant.$transaction([
      tenant.municipalEntity.createMany({
        data: flat.map((n) => ({
          id: ids[n.index] ?? randomUUID(),
          organizationId: actor.organizationId,
          parentId:
            n.parentIndex === null ? null : (ids[n.parentIndex] ?? null),
          name: n.name,
          description: n.description,
          sortOrder: n.sortOrder,
        })),
      }),
    ]);
    await this.prisma.organization.update({
      where: { id: actor.organizationId },
      data: { orgChartTemplate: key },
    });
    return { created: flat.length };
  }

  // ── Reglas ────────────────────────────────────────────────────────────────

  private async assertNameFree(
    organizationId: string,
    parentId: string | null,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const siblings = await this.prisma
      .forTenant(organizationId)
      .municipalEntity.findMany({
        where: { parentId, archivedAt: null },
        select: { id: true, name: true },
      });
    const key = siblingKey(name);
    if (siblings.some((s) => s.id !== exceptId && siblingKey(s.name) === key)) {
      throw new ConflictException(
        `Ya existe un ente llamado «${name}» en este nivel`,
      );
    }
  }

  private async assertCanMove(
    organizationId: string,
    id: string,
    newParentId: string | null,
  ): Promise<void> {
    const all = await this.prisma
      .forTenant(organizationId)
      .municipalEntity.findMany({
        select: { id: true, parentId: true, archivedAt: true },
      });
    if (newParentId !== null) {
      const parent = all.find((e) => e.id === newParentId);
      if (!parent) throw new NotFoundException('El nuevo ente padre no existe');
      if (parent.archivedAt)
        throw new BadRequestException('No se puede mover a un ente archivado');
    }
    if (wouldCreateCycle(id, newParentId, all)) {
      throw new BadRequestException(
        'Un ente no puede quedar dentro de sí mismo ni de sus descendientes',
      );
    }
  }
}
