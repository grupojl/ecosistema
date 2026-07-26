/**
 * src/trpc/routers/config-quotas.router.ts
 *
 * Firmas reales:
 *   ConfigQuotasService.getForOrg(organizationId)
 *   ConfigQuotasService.updateLimit(orgId, userId, resource, limit)
 *     limit: number (−1 = ilimitado)
 */
import { z }                       from 'zod';
import { router, ownerProcedure, tenantProcedure } from '../trpc';
import type { ConfigQuotasService } from '../../config-quotas/config-quotas.service';

export function createConfigQuotasRouter(quotasService: ConfigQuotasService) {
  return router({

    /**
     * configQuotas.list
     * Quotas y uso actual de la org. Solo OWNER.
     */
    list: ownerProcedure.query(async ({ ctx }) => {
      return quotasService.getForOrg(ctx.organizationId);
    }),

    /**
     * configQuotas.updateLimit
     * Actualiza el límite de un recurso. Solo OWNER.
     * resource: 'members' | 'api_keys' | 'monthly_api_calls' | 'storage_mb' | ...
     */
    updateLimit: ownerProcedure
      .input(z.object({
        resource: z.string().min(1),
        limit:    z.number().int().min(-1),
      }))
      .mutation(async ({ ctx, input }) => {
        return quotasService.updateLimit(ctx.organizationId, ctx.uid, input.resource, input.limit);
      }),
  });
}
