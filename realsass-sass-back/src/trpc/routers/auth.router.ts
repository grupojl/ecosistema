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
import { z } from 'zod';
import { router, authProcedure, publicProcedure } from '@/trpc';
import type { UsersService } from '@/users/users.service';
import type { AuthService } from '@/auth/auth.service';
import type { DesktopLoginService } from '@/auth/desktop-login.service';

export function createAuthRouter(
  usersService: UsersService,
  authService: AuthService,
  desktopLogin: DesktopLoginService,
) {
  return router({
    /**
     * auth.me — perfil completo del usuario autenticado.
     * Equivalente a GET /api/v1/auth/me pero con tipo inferido.
     */
    me: authProcedure.query(async ({ ctx }) => {
      return usersService.getMyProfile(ctx.uid);
    }),

    /**
     * auth.sync — upsert del usuario + emisión de custom claims.
     * Llamado por auth-context tras login Firebase.
     * Equivalente a POST /api/v1/auth/sync.
     */
    sync: authProcedure
      .input(
        z.object({
          affiliateCode: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await authService.syncUser(
          {
            uid: ctx.uid,
            email: ctx.req.user?.email ?? '',
            displayName: ctx.req.user?.displayName ?? null,
            avatarUrl: ctx.req.user?.avatarUrl ?? null,
          },
          input.affiliateCode,
        );
        return { ok: true };
      }),

    /**
     * auth.ping — ¿la sesión sigue viva? Lo consultan los fronts al volver a la pestaña y cada ~30 s
     * para reflejar al instante un login/logout hecho en otro front del ecosistema (ADR-020).
     * Sin acceso a DB: el middleware ya verificó la cookie y que su `__sid` no esté revocado.
     */
    ping: authProcedure.query(({ ctx }) => ({
      ok: true as const,
      uid: ctx.uid,
    })),

    /**
     * auth.refreshClaims — reemite custom claims Firebase (ADR-003).
     * El front debe llamar getIdToken(true) después para obtener el token fresco.
     * Llamado cuando el usuario cambia de org activa.
     */
    refreshClaims: authProcedure.mutation(async ({ ctx }) => {
      await authService.refreshClaims(ctx.uid);
      return { ok: true };
    }),

    /**
     * auth.createDashboardSso — custom token Firebase para entrar al dashboard-front.
     * Reemplaza al POST /auth/firebase-sso (REST), que era un stub que solo redirigía.
     * La identidad sale de la cookie de sesión; no hace falta reenviar el idToken.
     */
    createDashboardSso: authProcedure.mutation(async ({ ctx }) => {
      return authService.generateCustomTokenForUid(ctx.uid);
    }),

    /**
     * auth.issueDesktopLoginCode — paso 2 del login de la app de escritorio (DT-DESK-3): con sesión, canjea el `challenge` PKCE
     * por un CÓDIGO de un solo uso (60 s). Por el loopback viaja el código, no un token.
     */
    issueDesktopLoginCode: authProcedure
      .input(z.object({ challenge: z.string().regex(/^[a-f0-9]{64}$/) }))
      .mutation(({ ctx, input }) =>
        desktopLogin.issue(ctx.uid, input.challenge),
      ),

    /**
     * auth.redeemDesktopLogin — paso 3: el webview de la app (aún sin sesión) canjea código + verifier por el custom token.
     * Es público a propósito: la prueba es el código aleatorio de 256 bits (un uso) más el verifier que solo conoce la app.
     */
    redeemDesktopLogin: publicProcedure
      .input(
        z.object({
          code: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
          verifier: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .mutation(({ input }) => desktopLogin.redeem(input.code, input.verifier)),

    /**
     * auth.selectRole — selecciona el rol/organización activa del usuario.
     * Después de esto el front debe llamar auth.refreshClaims + getIdToken(true).
     */
    selectRole: authProcedure
      .input(
        z.object({
          role: z.enum(['owner', 'affiliate']),
          organizationId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return usersService.selectRole(ctx.uid, {
          role: input.role,
          organizationId: input.organizationId,
        });
      }),
  });
}

export type AuthRouter = ReturnType<typeof createAuthRouter>;
