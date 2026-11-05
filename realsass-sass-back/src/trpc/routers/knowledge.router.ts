/**
 * knowledge.router.ts — `conocimiento.*` y `mandatos.*` (welver-domain.md §15.3).
 *
 * Todo pasa por los permisos por ente que resuelve el servicio (ver, editar, aprobar, publicar). Los mandatos
 * (fotos del organigrama y de lo publicado) son del dueño.
 */
import { router, tenantProcedure, ownerProcedure } from '@/trpc/trpc';
import type { KnowledgeService } from '@/welver/knowledge/knowledge.service';
import type { MandatesService } from '@/welver/mandates/mandates.service';
import { actorOf } from '@/trpc/routers/welver-actor';
import {
  CreateKnowledgeSchema,
  CreateMandateSchema,
  DuplicateMandateSchema,
  ImportCsvSchema,
  KnowledgeIdSchema,
  ListKnowledgeSchema,
  MandateIdSchema,
  RejectKnowledgeSchema,
  RenameMandateSchema,
  RestoreVersionSchema,
  UpdateKnowledgeSchema,
} from '@/welver/welver.schemas';

export function createKnowledgeRouter(knowledge: KnowledgeService) {
  return router({
    list: tenantProcedure
      .input(ListKnowledgeSchema.optional())
      .query(({ ctx, input }) =>
        knowledge.list(actorOf(ctx), ListKnowledgeSchema.parse(input ?? {})),
      ),

    get: tenantProcedure
      .input(KnowledgeIdSchema)
      .query(({ ctx, input }) => knowledge.get(actorOf(ctx), input.id)),

    create: tenantProcedure
      .input(CreateKnowledgeSchema)
      .mutation(({ ctx, input }) => knowledge.create(actorOf(ctx), input)),

    update: tenantProcedure
      .input(UpdateKnowledgeSchema)
      .mutation(({ ctx, input }) => {
        const { id, ...patch } = input;
        return knowledge.update(actorOf(ctx), id, patch);
      }),

    submit: tenantProcedure
      .input(KnowledgeIdSchema)
      .mutation(({ ctx, input }) =>
        knowledge.act(actorOf(ctx), input.id, 'submit'),
      ),

    reject: tenantProcedure
      .input(RejectKnowledgeSchema)
      .mutation(({ ctx, input }) =>
        knowledge.act(actorOf(ctx), input.id, 'reject', input.note),
      ),

    publish: tenantProcedure
      .input(KnowledgeIdSchema)
      .mutation(({ ctx, input }) => knowledge.publish(actorOf(ctx), input.id)),

    archive: tenantProcedure
      .input(KnowledgeIdSchema)
      .mutation(({ ctx, input }) =>
        knowledge.act(actorOf(ctx), input.id, 'archive'),
      ),

    unarchive: tenantProcedure
      .input(KnowledgeIdSchema)
      .mutation(({ ctx, input }) =>
        knowledge.act(actorOf(ctx), input.id, 'unarchive'),
      ),

    versions: tenantProcedure
      .input(KnowledgeIdSchema)
      .query(({ ctx, input }) => knowledge.versions(actorOf(ctx), input.id)),

    restoreVersion: tenantProcedure
      .input(RestoreVersionSchema)
      .mutation(({ ctx, input }) =>
        knowledge.restoreVersion(actorOf(ctx), input.id, input.version),
      ),

    importCsv: tenantProcedure
      .input(ImportCsvSchema)
      .mutation(({ ctx, input }) =>
        knowledge.importCsv(actorOf(ctx), input.csv, input.dryRun),
      ),
  });
}

export function createMandatesRouter(mandates: MandatesService) {
  return router({
    list: ownerProcedure.query(({ ctx }) => mandates.list(actorOf(ctx))),

    create: ownerProcedure
      .input(CreateMandateSchema)
      .mutation(({ ctx, input }) => mandates.create(actorOf(ctx), input)),

    duplicate: ownerProcedure
      .input(DuplicateMandateSchema)
      .mutation(({ ctx, input }) =>
        mandates.duplicate(actorOf(ctx), input.id, input.name),
      ),

    rename: ownerProcedure
      .input(RenameMandateSchema)
      .mutation(({ ctx, input }) =>
        mandates.rename(actorOf(ctx), input.id, input.name),
      ),

    restore: ownerProcedure
      .input(MandateIdSchema)
      .mutation(({ ctx, input }) => mandates.restore(actorOf(ctx), input.id)),

    remove: ownerProcedure
      .input(MandateIdSchema)
      .mutation(({ ctx, input }) => mandates.remove(actorOf(ctx), input.id)),
  });
}
