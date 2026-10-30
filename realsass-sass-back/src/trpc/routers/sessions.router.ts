/**
 * sessions.router.ts — realsass-sass-back (ADR-020, contracts/user-sessions.md)
 *
 *   sessions.list         → sesiones activas del usuario, marcando la actual
 *   sessions.revoke       → cierra una sesión propia
 *   sessions.revokeOthers → cierra todas menos la actual
 *
 * authProcedure: no depende de la organización activa.
 */
import { z } from 'zod';
import { router, authProcedure } from '@/trpc';
import { SESSION_ID_COOKIE_NAME } from '@real/auth-server';
import type { SessionsService } from '@/sessions/sessions.service';
import type { Request } from 'express';

function currentSid(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined> | undefined)?.[
    SESSION_ID_COOKIE_NAME
  ];
}

export function createSessionsRouter(sessionsService: SessionsService) {
  return router({
    list: authProcedure.query(({ ctx }) =>
      sessionsService.list(ctx.uid, currentSid(ctx.req)),
    ),

    revoke: authProcedure
      .input(z.object({ sessionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await sessionsService.revoke(ctx.uid, input.sessionId);
        return {
          ok: true,
          wasCurrent: input.sessionId === currentSid(ctx.req),
        };
      }),

    revokeOthers: authProcedure.mutation(async ({ ctx }) => ({
      ok: true,
      revoked: await sessionsService.revokeOthers(ctx.uid, currentSid(ctx.req)),
    })),
  });
}
