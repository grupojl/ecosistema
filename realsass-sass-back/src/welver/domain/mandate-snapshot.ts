/**
 * mandate-snapshot.ts — foto del organigrama y de los datos publicados por mandato (welver-domain.md §13.2 «Cambio de gestión»).
 *
 * Dominio puro. El snapshot guarda el organigrama (con ids) y, de cada dato, SOLO su última versión publicada.
 * Restaurar conserva los ids: nada se borra nunca (los entes y datos se archivan), así los canales, los permisos y las
 * versiones que cuelgan de esos ids siguen apuntando al lugar correcto.
 */
import { z } from 'zod';
import { childrenMap } from '@/welver/domain/org-tree';

export const SNAPSHOT_VERSION = 1;

export const SnapshotEntitySchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  requiresApproval: z.boolean(),
  archived: z.boolean(),
});

export const SnapshotLinkSchema = z.object({
  fromEntityId: z.string(),
  toEntityId: z.string(),
  label: z.string().nullable(),
});

export const SnapshotKnowledgeSchema = z.object({
  itemId: z.string(),
  entityId: z.string(),
  title: z.string(),
  kind: z.enum(['TEXT', 'PDF']),
  content: z.string(),
  fileName: z.string().nullable(),
  fileUrl: z.string().nullable(),
  /** Versión publicada que se fotografió. */
  version: z.number().int().positive(),
});

export const MandateSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_VERSION),
  takenAt: z.string(),
  entities: z.array(SnapshotEntitySchema),
  links: z.array(SnapshotLinkSchema),
  knowledge: z.array(SnapshotKnowledgeSchema),
});

export type MandateSnapshot = z.infer<typeof MandateSnapshotSchema>;
export type SnapshotEntity = z.infer<typeof SnapshotEntitySchema>;
export type SnapshotKnowledge = z.infer<typeof SnapshotKnowledgeSchema>;

export interface EntityRow {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  requiresApproval: boolean;
  archivedAt: Date | null;
}
export interface LinkRow {
  fromEntityId: string;
  toEntityId: string;
  label: string | null;
}
export interface PublishedVersionRow {
  itemId: string;
  entityId: string;
  version: number;
  title: string;
  kind: 'TEXT' | 'PDF';
  content: string;
  fileName: string | null;
  fileUrl: string | null;
}

/** Arma el snapshot. De cada dato entra solo su versión publicada más alta. */
export function buildSnapshot(
  input: {
    entities: readonly EntityRow[];
    links: readonly LinkRow[];
    versions: readonly PublishedVersionRow[];
  },
  now: Date,
): MandateSnapshot {
  const latest = new Map<string, PublishedVersionRow>();
  for (const v of input.versions) {
    const current = latest.get(v.itemId);
    if (!current || v.version > current.version) latest.set(v.itemId, v);
  }
  return {
    schemaVersion: SNAPSHOT_VERSION,
    takenAt: now.toISOString(),
    entities: input.entities.map((e) => ({
      id: e.id,
      parentId: e.parentId,
      name: e.name,
      description: e.description,
      sortOrder: e.sortOrder,
      requiresApproval: e.requiresApproval,
      archived: e.archivedAt !== null,
    })),
    links: input.links.map((l) => ({
      fromEntityId: l.fromEntityId,
      toEntityId: l.toEntityId,
      label: l.label,
    })),
    knowledge: [...latest.values()].map((v) => ({
      itemId: v.itemId,
      entityId: v.entityId,
      title: v.title,
      kind: v.kind,
      content: v.content,
      fileName: v.fileName,
      fileUrl: v.fileUrl,
      version: v.version,
    })),
  };
}

/** Padres antes que hijos (el FK exige que el padre exista antes). Los que referencian un padre ausente van al final. */
export function orderParentsFirst<
  T extends { id: string; parentId: string | null },
>(entities: readonly T[]): T[] {
  const ids = new Set(entities.map((e) => e.id));
  const kids = childrenMap(entities);
  const result: T[] = [];
  const seen = new Set<string>();
  const visit = (e: T): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    result.push(e);
    for (const child of kids.get(e.id) ?? []) visit(child);
  };
  for (const e of entities)
    if (e.parentId === null || !ids.has(e.parentId)) visit(e);
  for (const e of entities) visit(e); // ciclos o huérfanos: no se pierde ninguno
  return result;
}

export interface RestorePlan {
  /** Entes del snapshot, padres primero: se crean si faltan o se actualizan (incluye des-archivar). */
  entitiesToUpsert: SnapshotEntity[];
  /** Entes actuales que no están en el snapshot: se archivan. */
  entitiesToArchive: string[];
  /** Los vínculos se reemplazan por completo; solo los que tienen ambos extremos en el snapshot. */
  linksToCreate: z.infer<typeof SnapshotLinkSchema>[];
  /** Datos del snapshot: se restauran (copia de trabajo = versión fotografiada, como nueva versión publicada). */
  knowledgeToRestore: SnapshotKnowledge[];
  /** Datos actuales que no están en el snapshot: se archivan. */
  knowledgeToArchive: string[];
}

export function planRestore(
  snapshot: MandateSnapshot,
  current: {
    entityIds: readonly string[];
    knowledgeItemIds: readonly string[];
  },
): RestorePlan {
  const snapEntityIds = new Set(snapshot.entities.map((e) => e.id));
  const snapKnowledgeIds = new Set(snapshot.knowledge.map((k) => k.itemId));
  return {
    entitiesToUpsert: orderParentsFirst(snapshot.entities),
    entitiesToArchive: current.entityIds.filter((id) => !snapEntityIds.has(id)),
    linksToCreate: snapshot.links.filter(
      (l) =>
        snapEntityIds.has(l.fromEntityId) && snapEntityIds.has(l.toEntityId),
    ),
    // Un dato cuyo ente no está en el snapshot no se puede restaurar (quedaría huérfano).
    knowledgeToRestore: snapshot.knowledge.filter((k) =>
      snapEntityIds.has(k.entityId),
    ),
    knowledgeToArchive: current.knowledgeItemIds.filter(
      (id) => !snapKnowledgeIds.has(id),
    ),
  };
}

/** Resumen para listar mandatos sin enviar el contenido completo al front. */
export function summarizeSnapshot(snapshot: MandateSnapshot): {
  entities: number;
  links: number;
  knowledge: number;
  takenAt: string;
} {
  return {
    entities: snapshot.entities.filter((e) => !e.archived).length,
    links: snapshot.links.length,
    knowledge: snapshot.knowledge.length,
    takenAt: snapshot.takenAt,
  };
}
