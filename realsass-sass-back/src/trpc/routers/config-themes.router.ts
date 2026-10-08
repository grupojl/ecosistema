/**
 * src/trpc/routers/config-themes.router.ts
 *
 * Firmas reales de ConfigThemesService:
 *   list(organizationId)                  → temas de la org (+ sistema)
 *   create(organizationId, userId, dto)   → nuevo tema
 *   activate(organizationId, userId, id)  → activa (desactiva el anterior)
 *   remove(organizationId, userId, id)    → elimina (no activo, no system default)
 *
 * El tema público del storefront NO sale de acá (getPublicTheme es del flujo público).
 */
import { z }                                      from 'zod';
import { TRPCError }                            from '@trpc/server';
import { router, publicProcedure, tenantProcedure, ownerProcedure } from '@/trpc';
import type { ConfigThemesService }               from '@/config-themes/config-themes.service';
import type { OrganizationsService }              from '@/organizations/organizations.service';

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

const ThemeCreateInput = z.object({
  name:           z.string().min(1).max(100),
  primaryColor:   HexColor.optional(),
  secondaryColor: HexColor.optional(),
  accentColor:    HexColor.optional(),
  fontFamily:     z.string().max(100).optional(),
  borderRadius:   z.string().max(20).optional(),
  logoUrl:        z.string().url().optional(),
  faviconUrl:     z.string().url().optional(),
  darkMode:       z.boolean().optional(),
  customCSS:      z.string().max(50_000).optional(),
});

export function createConfigThemesRouter(
  themesService: ConfigThemesService,
  orgsService:   OrganizationsService,
) {
  return router({

    /**
     * configThemes.getPublicTheme
     * Tema activo de una org por slug — PÚBLICO (lo consume el storefront y el layout de sass-front).
     * Devuelve null si la org no existe o no tiene tema activo (el consumidor aplica el default).
     */
    getPublicTheme: publicProcedure
      .input(z.object({ orgSlug: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        const org = await orgsService.findBySlugPublic(input.orgSlug);
        if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organización no encontrada' });
        return themesService.getPublicTheme(org.organizationId);
      }),

    /**
     * configThemes.list
     * Temas de la org + temas del sistema (seeds).
     */
    list: tenantProcedure.query(async ({ ctx }) => {
      return themesService.list(ctx.organizationId);
    }),

    /**
     * configThemes.create
     * Crea un tema para la org. Solo OWNER.
     */
    create: ownerProcedure
      .input(ThemeCreateInput)
      .mutation(async ({ ctx, input }) => {
        return themesService.create(ctx.organizationId, ctx.uid, input);
      }),

    /**
     * configThemes.activate
     * Activa un tema (desactiva el anterior). OWNER o COLLABORATOR.
     */
    activate: tenantProcedure
      .input(z.object({ themeId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return themesService.activate(ctx.organizationId, ctx.uid, input.themeId);
      }),

    /**
     * configThemes.remove
     * Elimina un tema que no esté activo ni sea default del sistema. Solo OWNER.
     */
    remove: ownerProcedure
      .input(z.object({ themeId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return themesService.remove(ctx.organizationId, ctx.uid, input.themeId);
      }),
  });
}

export type ConfigThemesRouter = ReturnType<typeof createConfigThemesRouter>;
