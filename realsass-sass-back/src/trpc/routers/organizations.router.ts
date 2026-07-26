/**
 * src/trpc/routers/organizations.router.ts
 *
 * Firmas reales:
 *   OrganizationsService.getMyOrganization(firebaseUid)
 *   OrganizationsService.updateMyOrganization(firebaseUid, dto)
 *   OrganizationsService.findByUserId(userId)
 */
import { z }                    from 'zod';
import { router, authProcedure } from '../trpc';
import type { OrganizationsService } from '../../organizations/organizations.service';

const UpdateOrgInput = z.object({
  name:        z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl:     z.string().url().optional(),
  website:     z.string().url().optional(),
  phone:       z.string().max(20).optional(),
  address:     z.string().max(200).optional(),
});

export function createOrganizationsRouter(orgsService: OrganizationsService) {
  return router({

    /**
     * organizations.me
     * Organización del usuario autenticado.
     * Llama a getMyOrganization(firebaseUid) que busca por firebaseUid.
     */
    me: authProcedure.query(async ({ ctx }) => {
      return orgsService.getMyOrganization(ctx.uid);
    }),

    /**
     * organizations.update
     * Actualiza perfil de la org del owner.
     * La verificación isOwner la hace el service internamente.
     */
    update: authProcedure
      .input(UpdateOrgInput)
      .mutation(async ({ ctx, input }) => {
        return orgsService.updateMyOrganization(ctx.uid, input);
      }),
  });
}
