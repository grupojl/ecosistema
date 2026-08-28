/**
 * auth.router.ts — realsass-sass-back
 *
 * Router tRPC de auth — expone los procedures que los fronts consumen
 * con type-safety end-to-end. Complementa (no reemplaza) el AuthController
 * REST que sigue existiendo para endpoints back-to-back y redirects.
 *
 * Procedures:
 *   auth.me            → perfil completo del usuario autenticado
 *   auth.sync          → upsert del usuario + emisión de custom claims
 *   auth.refreshClaims → reemite claims (cambio de org activa — ADR-003)
 *   auth.selectRole    → selecciona el rol activo del usuario
 *
 * Por qué no están en REST:
 *   Los fronts ya usan tRPC para todo. Tener auth en REST fuerza a los fronts
 *   a mantener dos clientes (tRPC + apiFetch) para endpoints de la misma sesión.
 *   Moverlos a tRPC unifica el cliente y da type-safety en los inputs/outputs.
 *
 * Por qué firebase-sso y organization-access siguen en REST:
 *   firebase-sso es un redirect entre servicios — necesita res.redirect().
 *   organization-access es consumido por ecommerce-back vía HTTP, no por un front.
 */
import { z }                   from 'zod';
import { router, authProcedure } from '../trpc';
import type { UsersService }   from '../../users/users.service';
import type { AuthService }    from '../../auth/auth.service';

export function createAuthRouter(
  usersService: UsersService,
  authService:  AuthService,
) {
  return router({

    /**
     * auth.me — perfil completo del usuario autenticado.
     * Equivalente a GET /api/v1/auth/me pero con tipo inferido.
     */
    me: authProcedure
      .query(async ({ ctx }) => {
        return usersService.getMyProfile(ctx.uid!);
      }),

    /**
     * auth.sync — upsert del usuario + emisión de custom claims.
     * Llamado por auth-context tras login Firebase.
     * Equivalente a POST /api/v1/auth/sync.
     */
    sync: authProcedure
      .input(z.object({
        affiliateCode: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await authService.syncUser(
          { uid: ctx.uid!, email: ctx.req.user?.email },
          input.affiliateCode,
        );
        return { ok: true };
      }),

    /**
     * auth.refreshClaims — reemite custom claims Firebase (ADR-003).
     * El front debe llamar getIdToken(true) después para obtener el token fresco.
     * Llamado cuando el usuario cambia de org activa.
     */
    refreshClaims: authProcedure
      .mutation(async ({ ctx }) => {
        await authService.refreshClaims(ctx.uid!);
        return { ok: true };
      }),

    /**
     * auth.selectRole — selecciona el rol/organización activa del usuario.
     * Después de esto el front debe llamar auth.refreshClaims + getIdToken(true).
     */
    selectRole: authProcedure
      .input(z.object({
        role:           z.enum(['owner', 'affiliate']),
        organizationId: z.string().uuid().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return usersService.selectRole(ctx.uid!, {
          role:           input.role,
          organizationId: input.organizationId,
        });
      }),

  });
}

export type AuthRouter = ReturnType<typeof createAuthRouter>;
