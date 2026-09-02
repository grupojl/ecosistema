import { z }                                       from 'zod';
import { router, tenantProcedure, ownerProcedure } from '../trpc';
import type { ConfigTemplatesService }             from '../../config-templates/config-templates.service';

export function createConfigTemplatesRouter(templatesService: ConfigTemplatesService) {
  return router({

    list: tenantProcedure
      .query(({ ctx }) =>
        templatesService.list(ctx.tenant!.organizationId),
      ),

    resolve: tenantProcedure
      .input(z.object({ key: z.string() }))
      .query(({ ctx, input }) =>
        templatesService.resolve(ctx.tenant!.organizationId, input.key),
      ),

    render: tenantProcedure
      .input(z.object({
        key:       z.string(),
        variables: z.record(z.string()),
      }))
      .mutation(({ ctx, input }) =>
        templatesService.renderByKey(ctx.tenant!.organizationId, input.key, input.variables),
      ),

    create: ownerProcedure
      .input(z.object({
        key:         z.string().min(1),
        content:     z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        templatesService.create(ctx.tenant!.organizationId, ctx.uid!, input),
      ),
  });
}

export type ConfigTemplatesRouter = ReturnType<typeof createConfigTemplatesRouter>;
