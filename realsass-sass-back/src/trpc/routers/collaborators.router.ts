/**
 * src/trpc/routers/collaborators.router.ts
 *
 * Firmas reales:
 *   CollaboratorsService.listCollaborators(firebaseUid)
 *   CollaboratorsService.inviteCollaborator(firebaseUid, dto)
 *   CollaboratorsService.updateCollaborator(firebaseUid, collaboratorId, dto)
 *   CollaboratorsService.removeCollaborator(firebaseUid, collaboratorId)
 *   CollaboratorsService.acceptInvitation(token, firebaseUid)
 *   CollaboratorsService.getInvitationInfo(token)   ← pública, no se expone en tRPC auth
 *
 * NOTA: getInvitationInfo e acceptInvitation quedan en REST porque
 *   getInvitationInfo es una ruta @Public() sin auth.
 *   acceptInvitation sí se expone acá para el flujo autenticado.
 */
import { z }                    from 'zod';
import { router, authProcedure } from '../trpc';
import type { CollaboratorsService } from '../../collaborators/collaborators.service';

const PermissionsInput = z.object({
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

    /**
     * collaborators.list
     * Lista colaboradores de la org del owner autenticado.
     */
    list: authProcedure.query(async ({ ctx }) => {
      return collaboratorsService.listCollaborators(ctx.uid);
    }),

    /**
     * collaborators.invite
     * Genera invitación para un email con permisos configurables.
     */
    invite: authProcedure
      .input(z.object({
        email: z.string().email(),
        ...PermissionsInput.shape,
      }))
      .mutation(async ({ ctx, input }) => {
        return collaboratorsService.inviteCollaborator(ctx.uid, input);
      }),

    /**
     * collaborators.update
     * Actualiza permisos de un colaborador.
     */
    update: authProcedure
      .input(z.object({
        collaboratorId: z.string().uuid(),
        permissions:    PermissionsInput,
      }))
      .mutation(async ({ ctx, input }) => {
        return collaboratorsService.updateCollaborator(ctx.uid, input.collaboratorId, input.permissions);
      }),

    /**
     * collaborators.remove
     * Soft delete del colaborador (status → REMOVED).
     */
    remove: authProcedure
      .input(z.object({ collaboratorId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return collaboratorsService.removeCollaborator(ctx.uid, input.collaboratorId);
      }),

    /**
     * collaborators.acceptInvitation
     * El colaborador autenticado acepta la invitación por token.
     */
    acceptInvitation: authProcedure
      .input(z.object({ token: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return collaboratorsService.acceptInvitation(input.token, ctx.uid);
      }),
  });
}
