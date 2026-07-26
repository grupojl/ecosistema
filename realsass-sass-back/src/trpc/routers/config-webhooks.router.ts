/**
 * src/trpc/routers/config-webhooks.router.ts
 *
 * Gestión de endpoints webhook (CRUD del dashboard).
 * El delivery outbound (BullMQ processor) permanece en REST — es llamada de sistema.
 *
 * Firmas reales:
 *   ConfigWebhooksService.list(organizationId)
 *   ConfigWebhooksService.create(organizationId, userId, dto)
 *     dto: { url: string, events: string[] }
 *   ConfigWebhooksService.remove(organizationId, userId, id)
 *   ConfigWebhooksService.getLogs(organizationId, id, take)
 *   ConfigWebhooksService.test(organizationId, id)   ← también disponible
 */
import { z }               from 'zod';
import { router, ownerProcedure } from '../trpc';
import type { ConfigWebhooksService } from '../../config-webhooks/config-webhooks.service';

export function createConfigWebhooksRouter(webhooksService: ConfigWebhooksService) {
  return router({

    list: ownerProcedure.query(async ({ ctx }) => {
      return webhooksService.list(ctx.organizationId);
    }),

    create: ownerProcedure
      .input(z.object({
        url:         z.string().url(),
        events:      z.array(z.string()).min(1),
        description: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return webhooksService.create(ctx.organizationId, ctx.uid, input);
      }),

    remove: ownerProcedure
      .input(z.object({ webhookId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return webhooksService.remove(ctx.organizationId, ctx.uid, input.webhookId);
      }),

    test: ownerProcedure
      .input(z.object({ webhookId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return webhooksService.test(ctx.organizationId, input.webhookId);
      }),

    getLogs: ownerProcedure
      .input(z.object({
        webhookId: z.string().uuid(),
        take:      z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ ctx, input }) => {
        return webhooksService.getLogs(ctx.organizationId, input.webhookId, input.take);
      }),
  });
}
