/**
 * src/trpc/routers/org-settings.router.ts
 *
 *   settings.get                 cualquier miembro: ver la configuración (con valores por defecto si no hay nada guardado)
 *   settings.updateGeneral       solo OWNER
 *   settings.updateStorefront    solo OWNER
 *   settings.getPublicStorefront PÚBLICO por slug: solo lo que la organización decidió mostrar
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, tenantProcedure, ownerProcedure } from '@/trpc';
import {
  GeneralSettingsSchema,
  StorefrontSettingsSchema,
} from '@/org-settings/org-settings.schema';
import type { OrgSettingsService } from '@/org-settings/org-settings.service';
import type { OrganizationsService } from '@/organizations/organizations.service';

export function createOrgSettingsRouter(
  settingsService: OrgSettingsService,
  orgsService: OrganizationsService,
) {
  return router({
    /** `canEdit` lo decide el servidor (solo el dueño escribe): los fronts no deducen el rol por su cuenta. */
    get: tenantProcedure.query(async ({ ctx }) => ({
      ...(await settingsService.get(ctx.organizationId)),
      canEdit: ctx.role === 'OWNER',
    })),

    updateGeneral: ownerProcedure
      .input(GeneralSettingsSchema)
      .mutation(({ ctx, input }) =>
        settingsService.updateGeneral(ctx.organizationId, ctx.uid, input),
      ),

    updateStorefront: ownerProcedure
      .input(StorefrontSettingsSchema)
      .mutation(({ ctx, input }) =>
        settingsService.updateStorefront(ctx.organizationId, ctx.uid, input),
      ),

    getPublicStorefront: publicProcedure
      .input(z.object({ orgSlug: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        const org = await orgsService.findBySlugPublic(input.orgSlug);
        if (!org)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organización no encontrada',
          });
        return settingsService.getPublicStorefront(org.organizationId);
      }),
  });
}

export type OrgSettingsRouter = ReturnType<typeof createOrgSettingsRouter>;
