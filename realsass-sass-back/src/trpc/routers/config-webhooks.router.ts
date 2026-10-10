/**
 * src/trpc/routers/config-webhooks.router.ts
 *
 * El secreto de firma (HMAC) se genera en el servidor, se guarda cifrado y se devuelve EN CLARO una sola
 * vez: al crear el webhook o al rotarlo. Después solo se ve una pista (últimos 4 caracteres).
 * Crear, rotar y eliminar exigen re-autenticación reciente (step-up).
 */
import { z }                      from 'zod';
import { router, ownerProcedure } from '@/trpc';
import { enforceStepUp }          from '@/trpc/step-up';
import type { ConfigWebhooksService } from '@/config-webhooks/config-webhooks.service';

const EventName = z.string().trim().min(1).max(64).regex(/^(\*|[a-z0-9_.:-]+)$/i, 'Evento inválido');

export function createConfigWebhooksRouter(webhooksService: ConfigWebhooksService) {
  return router({

    list: ownerProcedure.query(async ({ ctx }) => {
      return webhooksService.list(ctx.organizationId);
    }),

    create: ownerProcedure
      .input(z.object({
        url:         z.string().trim().url().max(2048),
        events:      z.array(EventName).min(1).max(20),
        description: z.string().max(200).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return webhooksService.create(ctx.organizationId, ctx.uid, input);
      }),

    rotateSecret: ownerProcedure
      .input(z.object({ webhookId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return webhooksService.rotateSecret(ctx.organizationId, ctx.uid, input.webhookId);
      }),

    remove: ownerProcedure
      .input(z.object({ webhookId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
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
