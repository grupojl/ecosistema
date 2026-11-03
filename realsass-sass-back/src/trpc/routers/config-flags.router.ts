/**
 * src/trpc/routers/config-flags.router.ts
 *
 * Firmas reales:
 *   ConfigFlagsService.list(organizationId)        → todos los flags (org + globales)
 *   ConfigFlagsService.getForOrg(orgId, role?, plan?) → flags evaluados/filtrados
 *   ConfigFlagsService.update(orgId, userId, flagId, dto)
 *
 * dto shape (UpdateFlagDto):
 *   enabled?: boolean
 *   description?: string
 *   rolloutPercentage?: number (0-100)
 *   conditions?: Record<string, unknown>
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, tenantProcedure } from '@/trpc';
import type { ConfigFlagsService } from '@/config-flags/config-flags.service';

export function createConfigFlagsRouter(flagsService: ConfigFlagsService) {
  return router({
    /**
     * configFlags.list
     * Todos los flags de la org + globales (sin filtrar, para gestión en el dashboard).
     */
    list: tenantProcedure.query(async ({ ctx }) => {
      return flagsService.list(ctx.organizationId);
    }),

    /**
     * configFlags.update
     * Actualiza enabled, description, rolloutPercentage o conditions de un flag.
     * OWNER o COLLABORATOR pueden hacer toggle. Solo OWNER puede cambiar rollout.
     */
    update: tenantProcedure
      .input(
        z.object({
          flagId: z.string().uuid(),
          enabled: z.boolean().optional(),
          description: z.string().max(200).optional(),
          rolloutPercentage: z.number().int().min(0).max(100).optional(),
          conditions: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { flagId, ...dto } = input;
        // Documentado arriba: el rollout lo cambia solo el dueño (un colaborador sí puede hacer toggle).
        if (dto.rolloutPercentage !== undefined && ctx.role !== 'OWNER')
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Solo el dueño puede cambiar el porcentaje de rollout',
          });
        return flagsService.update(ctx.organizationId, ctx.uid, flagId, dto);
      }),
  });
}
