/**
 * mandates.service.ts — cambio de gestión por mandato (welver-domain.md §13.2).
 *
 * Un mandato es una FOTO del organigrama y de lo publicado. Se puede tomar, restaurar o duplicar. Restaurar conserva
 * los ids (nada se borra jamás), así que canales, permisos y versiones siguen apuntando bien; antes de restaurar se toma
 * una foto automática del estado actual, para poder volver atrás. Solo el dueño opera mandatos.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, toTransactionClient } from '@/prisma/prisma.service';
import { toJsonValue } from '@/common/prisma/json';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import { ConfigAuditService } from '@/config-audit/config-audit.service';
import {
  MandateSnapshotSchema,
  buildSnapshot,
  planRestore,
  summarizeSnapshot,
  type MandateSnapshot,
} from '@/welver/domain/mandate-snapshot';
import type { WelverActor } from '@/welver/welver.types';

export interface CreateMandateInput {
  name: string;
  startsAt?: Date;
  endsAt?: Date;
}

@Injectable()
export class MandatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: ConfigAuditService,
  ) {}

  async list(actor: WelverActor) {
    (await this.access.forActor(actor)).assertOwner();
    const rows = await this.prisma
      .forTenant(actor.organizationId)
      .mandate.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((m) => {
      const parsed = MandateSnapshotSchema.safeParse(m.snapshot);
      return {
        id: m.id,
        name: m.name,
        status: m.status,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        createdAt: m.createdAt,
        createdBy: m.createdBy,
        summary: parsed.success ? summarizeSnapshot(parsed.data) : null,
      };
    });
  }

  /** Foto del estado actual. Queda ARCHIVED: es una copia de seguridad que no cambia lo que está en uso. */
  async create(actor: WelverActor, input: CreateMandateInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const snapshot = await this.takeSnapshot(actor.organizationId);
    const mandate = await this.prisma
      .forTenant(actor.organizationId)
      .mandate.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          status: 'ARCHIVED',
          snapshot: toJsonValue(snapshot),
          createdBy: actor.uid,
        },
      });
    this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.uid,
      configType: 'mandate',
      configKey: mandate.id,
      action: 'create',
    });
    return {
      id: mandate.id,
      name: mandate.name,
      status: mandate.status,
      summary: summarizeSnapshot(snapshot),
    };
  }

  async duplicate(actor: WelverActor, id: string, name: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const source = await this.load(actor.organizationId, id);
    const copy = await this.prisma
      .forTenant(actor.organizationId)
      .mandate.create({
        data: {
          organizationId: actor.organizationId,
          name,
          startsAt: source.startsAt,
          endsAt: source.endsAt,
          status: 'ARCHIVED',
          snapshot: toJsonValue(this.parse(source.snapshot)),
          createdBy: actor.uid,
        },
      });
    return { id: copy.id, name: copy.name, status: copy.status };
  }

  async rename(actor: WelverActor, id: string, name: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    await this.load(actor.organizationId, id);
    const updated = await this.prisma
      .forTenant(actor.organizationId)
      .mandate.update({ where: { id }, data: { name } });
    return { id: updated.id, name: updated.name };
  }

  async remove(actor: WelverActor, id: string): Promise<{ removed: boolean }> {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const mandate = await this.load(actor.organizationId, id);
    if (mandate.status === 'ACTIVE')
      throw new BadRequestException('No se puede eliminar el mandato en uso');
    await this.prisma
      .forTenant(actor.organizationId)
      .mandate.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * Restaura el organigrama y lo publicado del mandato. Todo en una transacción: o queda completo o no cambia nada.
   * Devuelve el id de la foto automática del estado anterior.
   */
  async restore(actor: WelverActor, id: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    (await this.access.forActor(actor)).assertOwner();
    const mandate = await this.load(actor.organizationId, id);
    const snapshot = this.parse(mandate.snapshot);
    const organizationId = actor.organizationId;
    const tenant = this.prisma.forTenant(organizationId);

    // 1. Foto de seguridad del estado actual (fuera de la transacción de restauración, para que sobreviva a un fallo).
    const backupSnapshot = await this.takeSnapshot(organizationId);
    const backup = await tenant.mandate.create({
      data: {
        organizationId,
        name: `Antes de restaurar «${mandate.name}»`,
        status: 'ARCHIVED',
        snapshot: toJsonValue(backupSnapshot),
        createdBy: actor.uid,
      },
    });

    // 2. Restauración atómica.
    const now = new Date();
    await tenant.$transaction(async (raw) => {
      const tx = toTransactionClient(raw);
      const [entities, items] = await Promise.all([
        tx.municipalEntity.findMany({
          where: { organizationId },
          select: { id: true },
        }),
        tx.knowledgeItem.findMany({
          where: { organizationId },
          select: { id: true, publishedVersion: true },
        }),
      ]);
      const plan = planRestore(snapshot, {
        entityIds: entities.map((e) => e.id),
        knowledgeItemIds: items.map((i) => i.id),
      });
      const existingEntities = new Set(entities.map((e) => e.id));
      const publishedVersionOf = new Map(
        items.map((i) => [i.id, i.publishedVersion]),
      );

      // Entes: padres primero. Crear si faltan; si existen, reponer nombre, lugar y estado.
      for (const e of plan.entitiesToUpsert) {
        const data = {
          parentId: e.parentId,
          name: e.name,
          description: e.description,
          sortOrder: e.sortOrder,
          requiresApproval: e.requiresApproval,
          archivedAt: e.archived ? now : null,
        };
        if (existingEntities.has(e.id)) {
          await tx.municipalEntity.update({ where: { id: e.id }, data });
        } else {
          await tx.municipalEntity.create({
            data: { id: e.id, organizationId, ...data },
          });
        }
      }
      if (plan.entitiesToArchive.length > 0) {
        await tx.municipalEntity.updateMany({
          where: {
            organizationId,
            id: { in: plan.entitiesToArchive },
            archivedAt: null,
          },
          data: { archivedAt: now },
        });
      }

      // Vínculos: se reemplazan por completo.
      await tx.entityLink.deleteMany({ where: { organizationId } });
      if (plan.linksToCreate.length > 0) {
        await tx.entityLink.createMany({
          data: plan.linksToCreate.map((l) => ({
            organizationId,
            fromEntityId: l.fromEntityId,
            toEntityId: l.toEntityId,
            label: l.label,
          })),
        });
      }

      // Conocimiento: lo fotografiado vuelve como NUEVA versión publicada (el historial nunca se reescribe).
      for (const k of plan.knowledgeToRestore) {
        const version = (publishedVersionOf.get(k.itemId) ?? 0) + 1;
        const fields = {
          entityId: k.entityId,
          title: k.title,
          kind: k.kind,
          content: k.content,
          fileName: k.fileName,
          fileUrl: k.fileUrl,
          status: 'PUBLISHED' as const,
          publishedVersion: version,
          archivedAt: null,
          indexedAt: null,
        };
        if (publishedVersionOf.has(k.itemId)) {
          await tx.knowledgeItem.update({
            where: { id: k.itemId },
            data: fields,
          });
        } else {
          await tx.knowledgeItem.create({
            data: {
              id: k.itemId,
              organizationId,
              authorUid: actor.uid,
              ...fields,
            },
          });
        }
        await tx.knowledgeVersion.create({
          data: {
            organizationId,
            itemId: k.itemId,
            version,
            title: k.title,
            kind: k.kind,
            content: k.content,
            fileName: k.fileName,
            fileUrl: k.fileUrl,
            publishedBy: actor.uid,
          },
        });
      }
      if (plan.knowledgeToArchive.length > 0) {
        await tx.knowledgeItem.updateMany({
          where: {
            organizationId,
            id: { in: plan.knowledgeToArchive },
            status: { not: 'ARCHIVED' },
          },
          data: { status: 'ARCHIVED', archivedAt: now },
        });
      }

      // El mandato restaurado pasa a estar en uso; el resto, archivado.
      await tx.mandate.updateMany({
        where: { organizationId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      await tx.mandate.update({ where: { id }, data: { status: 'ACTIVE' } });
    });

    this.audit.log({
      organizationId,
      userId: actor.uid,
      configType: 'mandate',
      configKey: id,
      action: 'restore',
      diff: { backupId: backup.id },
    });
    return {
      restored: summarizeSnapshot(snapshot),
      backupMandateId: backup.id,
    };
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  private async load(organizationId: string, id: string) {
    const mandate = await this.prisma
      .forTenant(organizationId)
      .mandate.findFirst({ where: { id } });
    if (!mandate) throw new NotFoundException('Mandato no encontrado');
    return mandate;
  }

  private parse(raw: unknown): MandateSnapshot {
    const parsed = MandateSnapshotSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException(
        'La foto del mandato está dañada o es de una versión incompatible',
      );
    return parsed.data;
  }

  /** Organigrama completo (con archivados, para conservar ids) + última versión publicada de cada dato no archivado. */
  private async takeSnapshot(organizationId: string): Promise<MandateSnapshot> {
    const tenant = this.prisma.forTenant(organizationId);
    const [entities, links, items] = await Promise.all([
      tenant.municipalEntity.findMany(),
      tenant.entityLink.findMany(),
      tenant.knowledgeItem.findMany({
        where: { publishedVersion: { gt: 0 }, status: { not: 'ARCHIVED' } },
        select: { id: true, entityId: true, publishedVersion: true },
      }),
    ]);
    const versions = items.length
      ? await tenant.knowledgeVersion.findMany({
          where: {
            OR: items.map((i) => ({
              itemId: i.id,
              version: i.publishedVersion,
            })),
          },
        })
      : [];
    const entityOf = new Map(items.map((i) => [i.id, i.entityId]));
    return buildSnapshot(
      {
        entities,
        links,
        versions: versions.flatMap((v) => {
          const entityId = entityOf.get(v.itemId);
          return entityId
            ? [
                {
                  itemId: v.itemId,
                  entityId,
                  version: v.version,
                  title: v.title,
                  kind: v.kind,
                  content: v.content,
                  fileName: v.fileName,
                  fileUrl: v.fileUrl,
                },
              ]
            : [];
        }),
      },
      new Date(),
    );
  }
}
