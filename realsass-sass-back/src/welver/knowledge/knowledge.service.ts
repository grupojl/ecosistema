/**
 * knowledge.service.ts — base de conocimiento por ente (welver-domain.md §13.2, §15.2 «Dato de conocimiento»).
 *
 * Cada dato tiene una COPIA DE TRABAJO (KnowledgeItem) y un historial de VERSIONES PUBLICADAS (KnowledgeVersion).
 * La IA solo usa la última versión publicada; editar un dato publicado no cambia lo que la IA responde hasta que se
 * publique de nuevo. El flujo (borrador → revisión → publicado) está en domain/knowledge-workflow.ts.
 *
 * Integración pendiente (a propósito): subir el PDF a un almacenamiento y extraer su texto, y copiar lo publicado al
 * índice de chatia. Acá quedan `indexedAt`, `listPendingIndex` y `markIndexed` listos para esa sincronización.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma';
import { EntityAccessService } from '@/welver/entity-access/entity-access.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  KnowledgeWorkflowError,
  requiredPermission,
  transition,
  type KnowledgeAction,
  type KnowledgeStatus,
} from '@/welver/domain/knowledge-workflow';
import { flattenTree, siblingKey } from '@/welver/domain/org-tree';
import { MAX_CONTENT_CHARS, parseKnowledgeCsv } from '@/welver/domain/csv';
import type { WelverActor } from '@/welver/welver.types';

export type KnowledgeKindValue = 'TEXT' | 'PDF';

export interface CreateKnowledgeInput {
  entityId: string;
  title: string;
  kind: KnowledgeKindValue;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSizeBytes?: number | null;
}

export interface ListKnowledgeInput {
  entityId?: string;
  status?: KnowledgeStatus;
  search?: string;
  page: number;
  limit: number;
}

/** La lista no trae el contenido completo (puede ser largo): solo un adelanto. */
const LIST_SELECT = {
  id: true,
  entityId: true,
  title: true,
  kind: true,
  fileName: true,
  status: true,
  publishedVersion: true,
  authorUid: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeItemSelect;

export interface CsvImportResult {
  dryRun: boolean;
  created: number;
  errors: { line: number; message: string }[];
  rows: { line: number; entityPath: string; title: string }[];
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EntityAccessService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async list(actor: WelverActor, input: ListKnowledgeInput) {
    const access = await this.access.forActor(actor);
    if (input.entityId) access.assert(input.entityId, 'view');
    const allowed = access.idsAllowing('view');

    const where: Prisma.KnowledgeItemWhereInput = {
      ...(input.entityId
        ? { entityId: input.entityId }
        : allowed
          ? { entityId: { in: [...allowed] } }
          : {}),
      ...(input.status && { status: input.status }),
      ...(input.search && {
        title: { contains: input.search, mode: 'insensitive' },
      }),
    };
    const tenant = this.prisma.forTenant(actor.organizationId);
    const [data, total] = await Promise.all([
      tenant.knowledgeItem.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      tenant.knowledgeItem.count({ where }),
    ]);
    return { data, total };
  }

  async get(actor: WelverActor, id: string) {
    const item = await this.load(actor.organizationId, id);
    (await this.access.forActor(actor)).assert(item.entityId, 'view');
    return item;
  }

  async create(actor: WelverActor, input: CreateKnowledgeInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    access.assert(input.entityId, 'edit');
    await this.assertEntityActive(actor.organizationId, input.entityId);
    this.assertShape(
      input.kind,
      input.content ?? '',
      input.fileUrl ?? null,
      false,
    );

    return this.prisma.forTenant(actor.organizationId).knowledgeItem.create({
      data: {
        organizationId: actor.organizationId,
        entityId: input.entityId,
        title: input.title,
        kind: input.kind,
        content: input.content ?? '',
        fileName: input.fileName ?? null,
        fileUrl: input.fileUrl ?? null,
        fileSizeBytes: input.fileSizeBytes ?? null,
        authorUid: actor.uid,
      },
    });
  }

  async update(actor: WelverActor, id: string, input: UpdateKnowledgeInput) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const item = await this.load(actor.organizationId, id);
    const entity = await this.entityOf(actor.organizationId, item.entityId);
    const access = await this.access.forActor(actor);
    access.assert(item.entityId, requiredPermission('edit', entity));

    const next = this.next(item.status, 'edit', entity);
    this.assertShape(
      item.kind,
      input.content ?? item.content,
      input.fileUrl === undefined ? item.fileUrl : input.fileUrl,
      false,
    );
    return this.prisma.forTenant(actor.organizationId).knowledgeItem.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.fileName !== undefined && { fileName: input.fileName }),
        ...(input.fileUrl !== undefined && { fileUrl: input.fileUrl }),
        ...(input.fileSizeBytes !== undefined && {
          fileSizeBytes: input.fileSizeBytes,
        }),
        status: next,
        reviewerUid: null,
        reviewNote: null,
      },
    });
  }

  /** submit | reject | archive | unarchive. Publicar tiene su propio método (crea la versión). */
  async act(
    actor: WelverActor,
    id: string,
    action: Exclude<KnowledgeAction, 'edit' | 'publish'>,
    note?: string,
  ) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const item = await this.load(actor.organizationId, id);
    const entity = await this.entityOf(actor.organizationId, item.entityId);
    const access = await this.access.forActor(actor);
    access.assert(item.entityId, requiredPermission(action, entity));
    const next = this.next(item.status, action, entity);

    if (action === 'submit')
      this.assertShape(item.kind, item.content, item.fileUrl, true);
    return this.prisma.forTenant(actor.organizationId).knowledgeItem.update({
      where: { id },
      data: {
        status: next,
        archivedAt:
          action === 'archive'
            ? new Date()
            : action === 'unarchive'
              ? null
              : item.archivedAt,
        ...(action === 'reject' && {
          reviewerUid: actor.uid,
          reviewNote: note ?? null,
        }),
        ...(action === 'submit' && { reviewerUid: null, reviewNote: null }),
      },
    });
  }

  /** Publica: congela la copia de trabajo como la versión N+1 y la IA pasa a usarla. */
  async publish(actor: WelverActor, id: string) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const item = await this.load(actor.organizationId, id);
    const entity = await this.entityOf(actor.organizationId, item.entityId);
    if (entity.archivedAt)
      throw new BadRequestException(
        'El ente está archivado: restauralo antes de publicar',
      );
    const access = await this.access.forActor(actor);
    access.assert(item.entityId, requiredPermission('publish', entity));
    const next = this.next(item.status, 'publish', entity);
    this.assertShape(item.kind, item.content, item.fileUrl, true);

    const version = item.publishedVersion + 1;
    const tenant = this.prisma.forTenant(actor.organizationId);
    try {
      await tenant.$transaction([
        tenant.knowledgeVersion.create({
          data: {
            organizationId: actor.organizationId,
            itemId: item.id,
            version,
            title: item.title,
            kind: item.kind,
            content: item.content,
            fileName: item.fileName,
            fileUrl: item.fileUrl,
            publishedBy: actor.uid,
          },
        }),
        tenant.knowledgeItem.update({
          where: { id: item.id },
          data: {
            status: next,
            publishedVersion: version,
            reviewerUid: entity.requiresApproval ? actor.uid : null,
            reviewNote: null,
            indexedAt: null, // hay algo nuevo que copiar al índice de la IA
          },
        }),
      ]);
    } catch (e) {
      // Dos publicaciones simultáneas del mismo dato chocan en (itemId, version): la segunda reintenta desde la pantalla.
      if (isUniqueViolation(e))
        throw new ConflictException(
          'El dato se publicó en otra pestaña: recargá e intentá de nuevo',
        );
      throw e;
    }
    return this.load(actor.organizationId, id);
  }

  async versions(actor: WelverActor, id: string) {
    const item = await this.load(actor.organizationId, id);
    (await this.access.forActor(actor)).assert(item.entityId, 'view');
    return this.prisma
      .forTenant(actor.organizationId)
      .knowledgeVersion.findMany({
        where: { itemId: id },
        orderBy: { version: 'desc' },
      });
  }

  /** Trae una versión vieja a la copia de trabajo como borrador. Para que la IA la use hay que publicarla (versión nueva). */
  async restoreVersion(actor: WelverActor, id: string, version: number) {
    await this.subscriptions.assertWritable(actor.organizationId);
    const item = await this.load(actor.organizationId, id);
    const entity = await this.entityOf(actor.organizationId, item.entityId);
    (await this.access.forActor(actor)).assert(item.entityId, 'edit');
    const next = this.next(item.status, 'edit', entity);

    const tenant = this.prisma.forTenant(actor.organizationId);
    const snapshot = await tenant.knowledgeVersion.findFirst({
      where: { itemId: id, version },
    });
    if (!snapshot) throw new NotFoundException('Versión no encontrada');
    return tenant.knowledgeItem.update({
      where: { id },
      data: {
        title: snapshot.title,
        kind: snapshot.kind,
        content: snapshot.content,
        fileName: snapshot.fileName,
        fileUrl: snapshot.fileUrl,
        status: next,
        reviewerUid: null,
        reviewNote: null,
      },
    });
  }

  /**
   * Carga masiva desde CSV (ente, titulo, contenido). Cada fila crea un BORRADOR en el ente indicado (por nombre o por
   * camino «Salud > Hospital»). Con `dryRun` solo valida. Todo o nada: si hay errores no se crea nada.
   */
  async importCsv(
    actor: WelverActor,
    text: string,
    dryRun: boolean,
  ): Promise<CsvImportResult> {
    if (!dryRun) await this.subscriptions.assertWritable(actor.organizationId);
    const access = await this.access.forActor(actor);
    const parsed = parseKnowledgeCsv(text);
    const errors = [...parsed.errors];

    const entities = await this.prisma
      .forTenant(actor.organizationId)
      .municipalEntity.findMany({
        where: { archivedAt: null },
        select: { id: true, parentId: true, name: true },
      });
    const flat = flattenTree(entities, (e) => e.name);
    const byPath = new Map<string, string[]>();
    const byName = new Map<string, string[]>();
    const push = (
      map: Map<string, string[]>,
      key: string,
      id: string,
    ): void => {
      map.set(key, [...(map.get(key) ?? []), id]);
    };
    for (const { node, path } of flat) {
      push(byPath, siblingKey(path.replace(/ › /g, ' > ')), node.id);
      push(byName, siblingKey(node.name), node.id);
    }

    const resolved: {
      entityId: string;
      entityPath: string;
      title: string;
      content: string;
      line: number;
    }[] = [];
    for (const row of parsed.rows) {
      const key = siblingKey(row.entity.replace(/\s*[>›/]\s*/g, ' > '));
      const matches = key.includes(' > ')
        ? (byPath.get(key) ?? [])
        : (byName.get(key) ?? []);
      const entityId = matches[0];
      if (matches.length === 0 || !entityId) {
        errors.push({
          line: row.line,
          message: `No existe el ente «${row.entity}»`,
        });
      } else if (matches.length > 1) {
        errors.push({
          line: row.line,
          message: `Hay más de un ente «${row.entity}»: usá el camino completo (Salud > Hospital)`,
        });
      } else if (!access.can(entityId, 'edit')) {
        errors.push({
          line: row.line,
          message: `No tenés permiso para cargar datos en «${row.entity}»`,
        });
      } else {
        resolved.push({
          entityId,
          entityPath: row.entity,
          title: row.title,
          content: row.content,
          line: row.line,
        });
      }
    }

    errors.sort((a, b) => a.line - b.line);
    const rows = resolved.map((r) => ({
      line: r.line,
      entityPath: r.entityPath,
      title: r.title,
    }));
    if (errors.length > 0 || dryRun)
      return { dryRun, created: 0, errors, rows };

    await this.prisma.forTenant(actor.organizationId).knowledgeItem.createMany({
      data: resolved.map((r) => ({
        organizationId: actor.organizationId,
        entityId: r.entityId,
        title: r.title,
        kind: 'TEXT' as const,
        content: r.content,
        authorUid: actor.uid,
      })),
    });
    return { dryRun, created: resolved.length, errors: [], rows };
  }

  // ── Sincronización con el índice de la IA (se completa en la integración) ──

  /** Datos con una versión publicada que todavía no está copiada al índice de la IA. */
  async listPendingIndex(organizationId: string, limit = 100) {
    return this.prisma.forTenant(organizationId).knowledgeItem.findMany({
      where: {
        publishedVersion: { gt: 0 },
        indexedAt: null,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true, entityId: true, publishedVersion: true },
      take: limit,
    });
  }

  async markIndexed(
    organizationId: string,
    itemIds: readonly string[],
    at = new Date(),
  ): Promise<number> {
    const { count } = await this.prisma
      .forTenant(organizationId)
      .knowledgeItem.updateMany({
        where: { id: { in: [...itemIds] } },
        data: { indexedAt: at },
      });
    return count;
  }

  // ── Interno ───────────────────────────────────────────────────────────────

  private async load(organizationId: string, id: string) {
    const item = await this.prisma
      .forTenant(organizationId)
      .knowledgeItem.findFirst({ where: { id } });
    if (!item) throw new NotFoundException('Dato no encontrado');
    return item;
  }

  private async entityOf(organizationId: string, entityId: string) {
    const entity = await this.prisma
      .forTenant(organizationId)
      .municipalEntity.findFirst({
        where: { id: entityId },
        select: { requiresApproval: true, archivedAt: true },
      });
    if (!entity) throw new NotFoundException('Ente no encontrado');
    return entity;
  }

  private async assertEntityActive(
    organizationId: string,
    entityId: string,
  ): Promise<void> {
    const entity = await this.entityOf(organizationId, entityId);
    if (entity.archivedAt)
      throw new BadRequestException(
        'No se pueden cargar datos en un ente archivado',
      );
  }

  private next(
    status: KnowledgeStatus,
    action: KnowledgeAction,
    ctx: { requiresApproval: boolean },
  ): KnowledgeStatus {
    try {
      return transition(status, action, ctx);
    } catch (e) {
      if (e instanceof KnowledgeWorkflowError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  /**
   * Un dato de texto necesita contenido; uno de PDF necesita el archivo o su texto extraído. Un borrador puede estar
   * vacío (se está escribiendo); para enviar a revisión o publicar (`strict`) no.
   */
  private assertShape(
    kind: KnowledgeKindValue,
    content: string,
    fileUrl: string | null,
    strict: boolean,
  ): void {
    if (content.length > MAX_CONTENT_CHARS)
      throw new BadRequestException(
        `El contenido supera ${MAX_CONTENT_CHARS} caracteres`,
      );
    if (!strict) return;
    if (kind === 'TEXT' && content.trim() === '')
      throw new BadRequestException('El dato no tiene contenido');
    if (kind === 'PDF' && !fileUrl && content.trim() === '')
      throw new BadRequestException(
        'El PDF no tiene archivo ni texto extraído',
      );
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e.code === 'P2002' || e.code === 'P2034')
  );
}
