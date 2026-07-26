/**
 * lib/config-client.ts
 *
 * Cliente para obtener la configuración pública de tema desde el
 * microservicio de configuración (config-service).
 *
 * En producción: usa NEXT_PUBLIC_CONFIG_API_URL para llamar al endpoint
 * GET /config/theme/:orgSlug
 *
 * Mientras el microservicio no esté disponible para esta instancia,
 * devuelve el tema por defecto (isDefaultTheme = true).
 */

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

const DEFAULT_THEME: PublicTheme = {
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
}

/**
 * Obtiene el tema público de una organización.
 * Server-side safe (no usa window ni localStorage).
 */
export async function getPublicTheme(orgSlug: string): Promise<PublicTheme> {
  const baseUrl = process.env['NEXT_PUBLIC_CONFIG_API_URL']

  if (!baseUrl || !orgSlug) {
    return DEFAULT_THEME
  }

  try {
    const res = await fetch(`${baseUrl}/config/theme/${orgSlug}`, {
      next: { revalidate: 300 }, // ISR: revalidar cada 5 minutos
    })

    if (!res.ok) return DEFAULT_THEME

    const json = await res.json() as { success: boolean; data: PublicTheme }
    return json.data ?? DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Retorna true si el tema es el tema por defecto del sistema
 * (sin personalización de la organización).
 */
export function isDefaultTheme(theme: PublicTheme): boolean {
  return theme.isSystemDefault === true || theme.id === null
}
