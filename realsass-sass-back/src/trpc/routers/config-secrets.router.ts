/**
 * src/trpc/routers/config-secrets.router.ts
 *
 * Secrets cifrados con AES-256-GCM.
 * El valor nunca se devuelve en claro — list() omite valueEncrypted.
 *
 * Firmas reales:
 *   ConfigSecretsService.list(organizationId)
 *   ConfigSecretsService.create(organizationId, userId, dto, ip?)
 *   ConfigSecretsService.rotate(organizationId, userId, id, value, ip?)
 *   ConfigSecretsService.revoke(organizationId, userId, id, ip?)
 *
 * NOTA: rotate y revoke en el controller REST usan @StepUpGuard
 * (re-autenticación en los últimos 5 min). En tRPC lo delegamos
 * al mismo StepUp verificando auth_time del token Firebase en el middleware.
 */
import { z }               from 'zod';
import { router, ownerProcedure } from '../trpc';
import * as admin          from 'firebase-admin';
import { TRPCError }       from '@trpc/server';
import type { ConfigSecretsService } from '../../config-secrets/config-secrets.service';

const STEP_UP_WINDOW_MS = 5 * 60 * 1000;

/** Verifica re-autenticación reciente (igual que StepUpGuard) */
async function enforceStepUp(token: string): Promise<void> {
  const decoded  = await admin.app().auth().verifyIdToken(token);
  const authTime = decoded.auth_time * 1000;
  if (Date.now() - authTime > STEP_UP_WINDOW_MS) {
    throw new TRPCError({
      code:    'FORBIDDEN',
      message: 'Re-autenticación requerida (ventana de 5 minutos)',
    });
  }
}

export function createConfigSecretsRouter(secretsService: ConfigSecretsService) {
  return router({

    list: ownerProcedure.query(async ({ ctx }) => {
      return secretsService.list(ctx.organizationId);
    }),

    create: ownerProcedure
      .input(z.object({
        key:          z.string().max(100),
        value:        z.string(),
        description:  z.string().max(300).optional(),
        systemTarget: z.enum(['chat', 'payments', 'ads', 'all']).optional(),
        expiresAt:    z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return secretsService.create(ctx.organizationId, ctx.uid, input as any, ctx.req.ip);
      }),

    rotate: ownerProcedure
      .input(z.object({ secretId: z.string().uuid(), value: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const token = ctx.req.headers.authorization?.split(' ')[1] ?? '';
        await enforceStepUp(token);
        return secretsService.rotate(ctx.organizationId, ctx.uid, input.secretId, input.value, ctx.req.ip);
      }),

    revoke: ownerProcedure
      .input(z.object({ secretId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const token = ctx.req.headers.authorization?.split(' ')[1] ?? '';
        await enforceStepUp(token);
        return secretsService.revoke(ctx.organizationId, ctx.uid, input.secretId, ctx.req.ip);
      }),
  });
}
