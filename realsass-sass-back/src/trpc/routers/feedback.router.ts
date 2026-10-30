/**
 * src/trpc/routers/feedback.router.ts
 *
 * Reportes de usuario (ADR-027). Cualquier miembro de la organización puede reportar; la organización y el rol salen
 * del contexto validado, nunca del input. El OWNER lista los de toda la organización, un colaborador los suyos.
 */
import { z } from 'zod';
import { router, tenantProcedure } from '@/trpc';
import type { FeedbackService } from '@/feedback/feedback.service';
import {
  CreateFeedbackSchema,
  ListFeedbackSchema,
} from '@/feedback/feedback.schemas';

export function createFeedbackRouter(feedbackService: FeedbackService) {
  return router({
    create: tenantProcedure
      .input(CreateFeedbackSchema)
      .mutation(({ ctx, input }) =>
        feedbackService.create(
          { organizationId: ctx.organizationId, uid: ctx.uid, role: ctx.role },
          input,
          ctx.req,
        ),
      ),

    listMine: tenantProcedure
      .input(ListFeedbackSchema.optional())
      .query(({ ctx, input }) =>
        feedbackService.listMine(
          { organizationId: ctx.organizationId, uid: ctx.uid, role: ctx.role },
          ListFeedbackSchema.parse(input ?? {}),
        ),
      ),

    getById: tenantProcedure
      .input(z.object({ id: z.string().min(1).max(64) }))
      .query(({ ctx, input }) =>
        feedbackService.getById(
          { organizationId: ctx.organizationId, uid: ctx.uid, role: ctx.role },
          input.id,
        ),
      ),
  });
}
