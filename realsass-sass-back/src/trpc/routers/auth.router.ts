/**
 * src/trpc/routers/auth.router.ts
 *
 * Procedures de autenticación.
 * Firma real de AuthService.syncUser: (firebaseUser: CurrentUserPayload, affiliateCode?)
 * CurrentUserPayload: { uid, email, emailVerified }
 */
import { z }                  from 'zod';
import { TRPCError }          from '@trpc/server';
import { router, authProcedure } from '../trpc';
import type { UsersService }  from '../../users/users.service';
import type { AuthService }   from '../../auth/auth.service';

export function createAuthRouter(
  usersService: UsersService,
  authService:  AuthService,
) {
  return router({

    /**
     * auth.me
     * Perfil completo: user + org + tenants + affiliateData
     * Llama a UsersService.getMyProfile(uid) → que internamente llama buildProfile
     */
    me: authProcedure.query(async ({ ctx }) => {
      const profile = await usersService.getMyProfile(ctx.uid);
      if (!profile) {
        throw new TRPCError({
          code:    'NOT_FOUND',
          message: 'Usuario no encontrado. Llamá a auth.sync primero.',
        });
      }
      return { success: true, data: profile };
    }),

    /**
     * auth.sync
     * Crea o sincroniza el usuario en la DB.
     * Reconstruye CurrentUserPayload desde req.user (ya verificado por Firebase).
     */
    sync: authProcedure
      .input(z.object({ affiliateCode: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const user = (ctx.req as any).user as {
          uid:           string;
          email:         string;
          emailVerified: boolean;
        };
        const result = await authService.syncUser(user, input.affiliateCode);
        return {
          success: true,
          isNew:   result.isNew,
          message: result.isNew ? 'Usuario creado exitosamente' : 'Usuario sincronizado exitosamente',
          data:    result.user,
        };
      }),

    /**
     * auth.dashboardAccess
     * Rol del usuario para el dashboard (OWNER | COLLABORATOR | none).
     */
    dashboardAccess: authProcedure.query(async ({ ctx }) => {
      return usersService.getDashboardAccess(ctx.uid);
    }),

    /**
     * auth.selectRole
     * Activa rol OWNER o AFFILIATE para el usuario.
     */
    selectRole: authProcedure
      .input(z.object({ role: z.enum(['owner', 'affiliate']) }))
      .mutation(async ({ ctx, input }) => {
        return usersService.selectRole(ctx.uid, { role: input.role as any });
      }),
  });
}
