// realsass-sass-front/lib/config-client.ts
//
// Reemplaza el fetch REST directo a /config/theme/:orgSlug.
// Ahora delega al procedure tRPC sass-back: configThemes.getPublicTheme
//
// Mantiene la misma firma pública para no romper theme-injector.ts
// ni ningún layout que llame getPublicTheme(orgSlug).
//
// ISR: el cache lo controla Next.js fetch internamente vía tRPC httpLink.
// Para forzar revalidación cada 5 min, usar:
//   export const revalidate = 300  en el layout/page que llame esto.

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@real/trpc';

// ─── Tipo público (mantenido para compatibilidad con theme-injector.ts) ────────

export interface PublicTheme {
  id:              string | null
  name:            string
  primaryColor:    string | null
  secondaryColor:  string | null
  accentColor:     string | null
  fontFamily:      string | null
  borderRadius:    string | null
  logoUrl:         string | null
  faviconUrl:      string | null
  darkMode:        boolean
  customCSS:       string | null
  isSystemDefault: boolean
  isActive:        boolean
}

// ─── Cliente tRPC server-side (sin React, sin hooks) ─────────────────────────

function getSassBackUrl(): string {
  const url = process.env.NEXT_PUBLIC_SASS_BACK_URL ?? process.env.SASS_BACK_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SASS_BACK_URL no está definida');
  return url;
}

function createServerTrpcClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getSassBackUrl()}/api/v1/trpc`,
        // Server-side: sin token Firebase — getPublicTheme es @Public()
      }),
    ],
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Obtiene el tema público de una organización por slug.
 * Server-side safe — no usa window ni localStorage.
 * Reemplaza: GET /config/theme/:orgSlug
 * Ahora usa: trpc.configThemes.getPublicTheme({ orgSlug })
 *
 * Capa 5 completa: tipo inferido desde SassAppRouter — sin cast as any.
 */
export async function getPublicTheme(orgSlug: string): Promise<PublicTheme> {
  try {
    const client = createServerTrpcClient();
    const theme = await client.configThemes.getPublicTheme.query({ orgSlug });
    return theme as PublicTheme;
  } catch {
    // Fallback: tema por defecto si el back no responde o el procedure no existe aún.
    // Mismo comportamiento que el cliente REST anterior.
    return defaultTheme();
  }
}

/**
 * Retorna true si el tema es el tema por defecto del sistema.
 */
export function isDefaultTheme(theme: PublicTheme): boolean {
  return theme.isSystemDefault;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function defaultTheme(): PublicTheme {
  return {
    id:              null,
    name:            'Default',
    primaryColor:    null,
    secondaryColor:  null,
    accentColor:     null,
    fontFamily:      null,
    borderRadius:    null,
    logoUrl:         null,
    faviconUrl:      null,
    darkMode:        false,
    customCSS:       null,
    isSystemDefault: true,
    isActive:        true,
  };
}
