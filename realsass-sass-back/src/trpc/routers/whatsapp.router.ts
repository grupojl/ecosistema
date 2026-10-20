/**
 * src/trpc/routers/whatsapp.router.ts
 *
 * WhatsApp de la organización (ADR-025). Solo el dueño ve el estado, conecta o desconecta, y conectar/desconectar
 * exigen re-autenticación reciente (step-up), igual que los secretos. La organización sale del contexto validado,
 * nunca del input. Nada de lo que devuelve incluye tokens de Meta.
 */
import { z }                      from 'zod';
import { router, ownerProcedure } from '@/trpc';
import { enforceStepUp }          from '@/trpc/step-up';
import type { WhatsappService }   from '@/whatsapp/whatsapp.service';

const Numeric = z.string().regex(/^\d{5,30}$/, 'Identificador inválido');

export function createWhatsappRouter(whatsappService: WhatsappService) {
  return router({

    status: ownerProcedure.query(({ ctx }) => whatsappService.getConnection(ctx.organizationId)),

    connect: ownerProcedure
      .input(z.object({
        code:          z.string().min(1).max(2048),
        wabaId:        Numeric,
        phoneNumberId: Numeric,
      }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return whatsappService.connect(ctx.organizationId, input);
      }),

    disconnect: ownerProcedure
      .input(z.object({ accountId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return whatsappService.disconnect(ctx.organizationId, input.accountId);
      }),

  });
}
