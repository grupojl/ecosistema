/**
 * collaborators.router.ts — realsass-sass-back
 *
 * Procedures:
 *   collaborators.list              → lista colaboradores del owner
 *   collaborators.invite            → invita un colaborador con permisos
 *   collaborators.update            → actualiza permisos
 *   collaborators.remove            → soft delete
 *   collaborators.acceptInvitation  → acepta la invitación (autenticado)
 *   collaborators.getInvitationInfo → info de invitación por token (@Public)
 */
import { z }                                        from 'zod';
import { router, authProcedure, publicProcedure }   from '../trpc';
import type { CollaboratorsService }                from '../../collaborators/collaborators.service';

const permissionsSchema = z.object({
  canViewListings:        z.boolean().optional(),
  canCreateListings:      z.boolean().optional(),
  canEditListings:        z.boolean().optional(),
  canDeleteListings:      z.boolean().optional(),
  canViewStats:           z.boolean().optional(),
  canManageLeads:         z.boolean().optional(),
  canManageCollaborators: z.boolean().optional(),
});

export function createCollaboratorsRouter(collaboratorsService: CollaboratorsService) {
  return router({

    list: authProcedure
      .query(({ ctx }) =>
        collaboratorsService.listCollaborators(ctx.uid!),
      ),

    invite: authProcedure
      .input(z.object({
        email: z.string().email(),
        permissions: permissionsSchema.optional(),
      }))
      .mutation(({ ctx, input }) =>
        collaboratorsService.inviteCollaborator(ctx.uid!, input),
      ),

    update: authProcedure
      .input(z.object({
        collaboratorId: z.string().uuid(),
        permissions:    permissionsSchema,
      }))
      .mutation(({ ctx, input }) =>
        collaboratorsService.updateCollaborator(ctx.uid!, input.collaboratorId, input.permissions),
      ),

    remove: authProcedure
      .input(z.object({ collaboratorId: z.string().uuid() }))
      .mutation(({ ctx, input }) =>
        collaboratorsService.removeCollaborator(ctx.uid!, input.collaboratorId),
      ),

    acceptInvitation: authProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ ctx, input }) =>
        collaboratorsService.acceptInvitation(input.token, ctx.uid!),
      ),

    /**
     * getInvitationInfo — @Public, sin auth
     * Cualquier usuario con el token puede ver los datos de la invitación.
     * Usado en /invite/[token] antes de que el usuario se autentique.
     */
    getInvitationInfo: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) =>
        collaboratorsService.getInvitationInfo(input.token),
      ),

  });
}

export type CollaboratorsRouter = ReturnType<typeof createCollaboratorsRouter>;
