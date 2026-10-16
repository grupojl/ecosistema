/**
 * lib/i18n/store-path.ts — URL de tienda con idioma. PURO.
 *
 * Las tiendas viven en /{locale}/{slug}/… (ADR-022). Antes eran /{locale}/tienda/{slug}/…: el prefijo "/tienda" ya no
 * existe, pero se sigue aceptando en la entrada para que los links viejos funcionen.
 */
import type { Locale } from '@/lib/i18n/config'

/** "/mi-marca/productos" → "/es/mi-marca/productos";  "/tienda/mi-marca" (link viejo) → "/es/mi-marca". */
export function storePathWithLocale(pathname: string, locale: Locale): string {
  const withoutLegacyPrefix = pathname.replace(/^\/tienda(?=\/|$)/, '')
  return `/${locale}${withoutLegacyPrefix}`
}
