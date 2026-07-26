/**
 * src/trpc/routers/config-audit.router.ts
 *
 * Firma real:
 *   ConfigAuditService.getByOrg(
 *     organizationId,
 *     filters: { configType?, from?, to?, userId? },
 *     take,
 *     skip
 *   )
 */
import { z }               from 'zod';
import { router, ownerProcedure } from '../trpc';
import type { ConfigAuditService } from '../../config-audit/config-audit.service';

export function createConfigAuditRouter(auditService: ConfigAuditService) {
  return router({

    list: ownerProcedure
      .input(z.object({
        configType: z.string().optional(),
        userId:     z.string().optional(),
        from:       z.string().datetime().optional(),
        to:         z.string().datetime().optional(),
        take:       z.number().int().min(1).max(200).default(50),
        skip:       z.number().int().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        return auditService.getByOrg(
          ctx.organizationId,
          {
            configType: input.configType,
            userId:     input.userId,
            from:       input.from ? new Date(input.from) : undefined,
            to:         input.to   ? new Date(input.to)   : undefined,
          },
          input.take,
          input.skip,
        );
      }),
  });
}
