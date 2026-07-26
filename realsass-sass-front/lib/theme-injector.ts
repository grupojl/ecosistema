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
 */

import type { PublicTheme } from './config-client'

/**
 * Genera el bloque :root { ... } con las custom properties del tema.
 * Si el tema es el default, devuelve string vacío (sin override).
 */
export function buildThemeCSS(theme: PublicTheme): string {
  const vars: string[] = []

  if (theme.primaryColor)   vars.push(`--color-primary: ${theme.primaryColor};`)
  if (theme.secondaryColor) vars.push(`--color-secondary: ${theme.secondaryColor};`)
  if (theme.accentColor)    vars.push(`--color-accent: ${theme.accentColor};`)
  if (theme.fontFamily)     vars.push(`--font-sans: ${theme.fontFamily}, sans-serif;`)
  if (theme.borderRadius)   vars.push(`--radius: ${theme.borderRadius};`)

  if (vars.length === 0 && !theme.customCSS) return ''

  const rootBlock = vars.length > 0
    ? `:root {\n  ${vars.join('\n  ')}\n}`
    : ''

  const customBlock = theme.customCSS ?? ''

  return [rootBlock, customBlock].filter(Boolean).join('\n\n')
}
