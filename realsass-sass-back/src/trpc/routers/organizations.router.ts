/**
 * src/trpc/routers/organizations.router.ts
 *
 * Firmas reales:
 *   OrganizationsService.getMyOrganization(firebaseUid, activeOrganizationId?)
 *   OrganizationsService.updateMyOrganization(firebaseUid, dto, activeOrganizationId?)
 *   OrganizationsService.listMine(firebaseUid) / createMine(firebaseUid, dto)   (D3)
 *   OrganizationsService.findByUserId(userId)
 */
import { z }                    from 'zod';
import { router, authProcedure } from '@/trpc';
import type { OrganizationsService } from '@/organizations/organizations.service';

const CreateOrgInput = z.object({
  name:        z.string().trim().min(2).max(100),
  countryCode: z.string().length(2).toUpperCase().optional(),
});

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
      // D4: la organización activa llega en x-organization-id; si no es propia, cae a la más antigua.
      return orgsService.getMyOrganization(ctx.uid, ctx.organizationId);
    }),

    /** organizations.list — D3: todas las organizaciones que posee el usuario. */
    list: authProcedure.query(async ({ ctx }) => {
      return orgsService.listMine(ctx.uid);
    }),

    /** organizations.create — D3: organización adicional (respeta el tope del plan). */
    create: authProcedure
      .input(CreateOrgInput)
      .mutation(async ({ ctx, input }) => {
        return orgsService.createMine(ctx.uid, input);
      }),

    /**
     * organizations.update
     * Actualiza perfil de la org del owner.
     * La verificación isOwner la hace el service internamente.
     */
    update: authProcedure
      .input(UpdateOrgInput)
      .mutation(async ({ ctx, input }) => {
        return orgsService.updateMyOrganization(ctx.uid, input, ctx.organizationId);
      }),
  });
}
