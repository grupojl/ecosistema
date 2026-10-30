/**
 * src/trpc/routers/config-secrets.router.ts
 *
 * Secrets cifrados con AES-256-GCM (iv y tag propios por valor).
 * El valor NUNCA se devuelve: list() solo expone nombre, pista (últimos 4), destino y fechas.
 *
 * Crear, rotar y revocar exigen re-autenticación reciente (step-up, ver trpc/step-up.ts).
 * Todas las operaciones por id están acotadas a la organización activa.
 */
import { z } from 'zod';
import { router, ownerProcedure } from '@/trpc';
import { enforceStepUp } from '@/trpc/step-up';
import type { ConfigSecretsService } from '@/config-secrets/config-secrets.service';

const SecretKey = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z][A-Za-z0-9_.-]{1,99}$/,
    'Usá letras, números, _ . - (2 a 100 caracteres)',
  );
const SecretValue = z.string().min(1).max(4096);

export function createConfigSecretsRouter(
  secretsService: ConfigSecretsService,
) {
  return router({
    list: ownerProcedure.query(async ({ ctx }) => {
      return secretsService.list(ctx.organizationId);
    }),

    create: ownerProcedure
      .input(
        z.object({
          key: SecretKey,
          value: SecretValue,
          description: z.string().max(300).optional(),
          systemTarget: z.enum(['chat', 'payments', 'ads', 'all']).optional(),
          expiresAt: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return secretsService.create(
          ctx.organizationId,
          ctx.uid,
          input,
          ctx.req.ip,
        );
      }),

    rotate: ownerProcedure
      .input(z.object({ secretId: z.string().uuid(), value: SecretValue }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return secretsService.rotate(
          ctx.organizationId,
          ctx.uid,
          input.secretId,
          input.value,
          ctx.req.ip,
        );
      }),

    revoke: ownerProcedure
      .input(z.object({ secretId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await enforceStepUp(ctx.req);
        return secretsService.revoke(
          ctx.organizationId,
          ctx.uid,
          input.secretId,
          ctx.req.ip,
        );
      }),
  });
}
