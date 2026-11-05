/**
 * quality.router.ts — `calidad.*` y `huecos.*` (welver-domain.md §15.3).
 *
 * Las corridas de calidad y el registro de huecos los hace la IA (integración) servicio-a-servicio con la clave interna.
 * El panel gestiona las preguntas, mira el veredicto y decide qué hacer con cada hueco.
 */
import { router, tenantProcedure, internalProcedure } from '@/trpc/trpc';
import type { QualityService } from '@/welver/quality/quality.service';
import type { GapsService } from '@/welver/gaps/gaps.service';
import { actorOf } from '@/trpc/routers/welver-actor';
import {
  CreateQuestionSchema,
  HistorySchema,
  InternalRecordGapSchema,
  InternalRecordRunSchema,
  ListGapsSchema,
  ListQuestionsSchema,
  PromoteGapSchema,
  QuestionIdSchema,
  SetGapStatusSchema,
  UpdateQuestionSchema,
  WeeklyGapsSchema,
} from '@/welver/welver.schemas';

export function createQualityRouter(quality: QualityService) {
  return router({
    questions: tenantProcedure
      .input(ListQuestionsSchema.optional())
      .query(({ ctx, input }) =>
        quality.listQuestions(actorOf(ctx), input?.kind),
      ),

    createQuestion: tenantProcedure
      .input(CreateQuestionSchema)
      .mutation(({ ctx, input }) =>
        quality.createQuestion(actorOf(ctx), input),
      ),

    updateQuestion: tenantProcedure
      .input(UpdateQuestionSchema)
      .mutation(({ ctx, input }) => {
        const { id, ...patch } = input;
        return quality.updateQuestion(actorOf(ctx), id, patch);
      }),

    removeQuestion: tenantProcedure
      .input(QuestionIdSchema)
      .mutation(({ ctx, input }) =>
        quality.removeQuestion(actorOf(ctx), input.id),
      ),

    history: tenantProcedure
      .input(HistorySchema.optional())
      .query(({ ctx, input }) => {
        const parsed = HistorySchema.parse(input ?? {});
        return quality.history(actorOf(ctx), parsed.kind, parsed.limit);
      }),

    /** ¿Se puede publicar el asistente? Calidad ≥95%, cobertura ≥70%, seguridad 100%. */
    readiness: tenantProcedure.query(({ ctx }) =>
      quality.readiness(ctx.organizationId),
    ),

    internalRecordRun: internalProcedure
      .input(InternalRecordRunSchema)
      .mutation(({ input }) =>
        quality.recordRun(
          input.organizationId,
          input.kind,
          input.items,
          input.triggeredBy,
        ),
      ),
  });
}

export function createGapsRouter(gaps: GapsService) {
  return router({
    weekly: tenantProcedure
      .input(WeeklyGapsSchema.optional())
      .query(({ ctx, input }) =>
        gaps.weekly(actorOf(ctx), WeeklyGapsSchema.parse(input ?? {}).limit),
      ),

    list: tenantProcedure
      .input(ListGapsSchema.optional())
      .query(({ ctx, input }) =>
        gaps.list(actorOf(ctx), ListGapsSchema.parse(input ?? {})),
      ),

    setStatus: tenantProcedure
      .input(SetGapStatusSchema)
      .mutation(({ ctx, input }) =>
        gaps.setStatus(actorOf(ctx), input.id, input.status),
      ),

    promoteToQuestion: tenantProcedure
      .input(PromoteGapSchema)
      .mutation(({ ctx, input }) =>
        gaps.promoteToQuestion(actorOf(ctx), input.id, input.expected),
      ),

    internalRecord: internalProcedure
      .input(InternalRecordGapSchema)
      .mutation(({ input }) =>
        gaps.record(input.organizationId, input.question, input.entityId),
      ),
  });
}
