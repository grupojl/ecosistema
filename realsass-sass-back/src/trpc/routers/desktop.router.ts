/**
 * src/trpc/routers/desktop.router.ts — app de escritorio (ADR-023).
 *
 * Públicos a propósito: los consulta el panel dentro de la app, incluso antes de iniciar sesión. No exponen datos de nadie:
 * `policy` devuelve la versión mínima/bloqueadas y `telemetry` solo acepta contadores (con consentimiento, sin identificadores).
 */
import { z } from 'zod';
import { router, publicProcedure } from '@/trpc';
import type { DesktopService } from '@/desktop/desktop.service';

const Semver = z.string().regex(/^\d+\.\d+\.\d+$/);

export function createDesktopRouter(desktopService: DesktopService) {
  return router({
    policy: publicProcedure.query(() => desktopService.getPolicy()),

    telemetry: publicProcedure
      .input(
        z.object({
          kind: z.enum(['ping', 'error']),
          version: Semver,
          os: z.enum(['windows', 'macos', 'linux', 'unknown']),
          message: z.string().max(1000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => ({
        accepted: await desktopService.record(input, ctx.req.ip),
      })),
  });
}
