/**
 * lib/theme-injector.ts
 *
 * Convierte un PublicTheme en un bloque de CSS custom properties
 * para inyectar en el <head> del layout (Server Component).
 *
 * Uso en layout.tsx:
 *   const theme = await getPublicTheme(orgSlug)
 *   const css   = buildThemeCSS(theme)
 *   // <style dangerouslySetInnerHTML={{ __html: css }} />
 *
 * SEGURIDAD: el tema lo edita el dueño de cada organización y se inyecta en una página que ven sus visitantes.
 * Un valor como `red;}</style><script>…` cerraría el bloque e inyectaría HTML (XSS almacenado). Por eso los valores de
 * las variables solo admiten caracteres de un color / tipografía / medida, y el CSS libre nunca puede contener `<`.
 */

import type { PublicTheme } from '@/lib/config-client'

/** Colores (#fff, rgb(1,2,3), hsl(...)), familias (Inter, 'Open Sans') y medidas (0.5rem, 8px). Sin ; { } < > \ : / @. */
const SAFE_TOKEN = /^[\w\s#%.,()'"-]+$/
/** Funciones que cargan recursos o ejecutan expresiones: nunca válidas en estos tokens. */
const FORBIDDEN_FN = /\b(url|expression|image-set|attr|var|calc-size)\s*\(/i

/** Devuelve el valor si es seguro; si no, null (la variable se omite y se usa el valor por defecto del sistema). */
export function safeCssToken(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (v.length === 0 || v.length > 120) return null
  if (!SAFE_TOKEN.test(v) || FORBIDDEN_FN.test(v)) return null
  return v
}

/** El CSS libre no necesita `<` (ni `<!--`, ni `</style`): sin él no se puede cerrar el <style> contenedor. */
export function safeCustomCss(css: string | null | undefined): string {
  return (css ?? '').replace(/</g, '')
}

/**
 * Genera el bloque :root { ... } con las custom properties del tema.
 * Si el tema es el default, devuelve string vacío (sin override).
 */
export function buildThemeCSS(theme: PublicTheme): string {
  const vars: string[] = []
  const primary = safeCssToken(theme.primaryColor)
  const secondary = safeCssToken(theme.secondaryColor)
  const accent = safeCssToken(theme.accentColor)
  const font = safeCssToken(theme.fontFamily)
  const radius = safeCssToken(theme.borderRadius)

  if (primary) vars.push(`--color-primary: ${primary};`)
  if (secondary) vars.push(`--color-secondary: ${secondary};`)
  if (accent) vars.push(`--color-accent: ${accent};`)
  if (font) vars.push(`--font-sans: ${font}, sans-serif;`)
  if (radius) vars.push(`--radius: ${radius};`)

  const custom = safeCustomCss(theme.customCSS)
  if (vars.length === 0 && !custom) return ''

  const rootBlock = vars.length > 0 ? `:root {\n  ${vars.join('\n  ')}\n}` : ''
  return [rootBlock, custom].filter(Boolean).join('\n\n')
}
