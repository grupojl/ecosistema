/**
 * src/trpc/routers/config-themes.router.ts
 *
 * Firmas reales (leídas del XML):
 *   ConfigThemesService.listForOrg(organizationId)
 *   ConfigThemesService.activate(organizationId, userId, themeId)
 *   ConfigThemesService.update(organizationId, userId, themeId, dto)
 *
 * dto de update (CreateThemeDto shape):
 *   primaryColor, secondaryColor, accentColor, fontFamily,
 *   borderRadius, logoUrl, faviconUrl, darkMode, customCSS
 */
import { z }                                      from 'zod';
import { router, tenantProcedure, ownerProcedure } from '../trpc';
import type { ConfigThemesService }               from '../../config-themes/config-themes.service';

const ThemeUpdateInput = z.object({
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor:    z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  fontFamily:     z.string().max(100).optional(),
  borderRadius:   z.string().max(20).optional(),
  logoUrl:        z.string().url().optional().nullable(),
  faviconUrl:     z.string().url().optional().nullable(),
  darkMode:       z.boolean().optional(),
  customCSS:      z.string().max(50_000).optional().nullable(),
});

export function createConfigThemesRouter(themesService: ConfigThemesService) {
  return router({

    /**
     * configThemes.list
     * Temas de la org + temas del sistema (seeds).
     */
    list: tenantProcedure.query(async ({ ctx }) => {
      return themesService.getPublicTheme(ctx.organizationId);
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
     * configThemes.update
     * Edita tokens de diseño de un tema. Solo OWNER.
     */
    update: ownerProcedure
      .input(z.object({
        themeId: z.string().uuid(),
        data:    ThemeUpdateInput,
      }))
      .mutation(async ({ ctx, input }) => {
        return themesService.activate(ctx.organizationId, ctx.uid, input.themeId);
      }),
  });
}
