/**
 * Contrato objetivo del contenido (architecture/12-docs-norte.md).
 * Es el shape que deberá devolver el router tRPC `docs` (F1). Los componentes
 * dependen de estos tipos, no de cómo se obtiene el dato.
 */

export const LOCALES = ['es', 'pt', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'

/** Diátaxis: qué necesita el lector. Obligatorio en toda página. */
export const DOC_KINDS = ['tutorial', 'how-to', 'reference', 'explanation'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export interface DocPage {
  /** 'primeros-pasos/crear-organizacion' */
  slug: string
  section: string
  locale: Locale
  kind: DocKind
  title: string
  description: string
  /** Markdoc. Nunca MDX ni HTML crudo. */
  body: string
  order: number
  status: 'draft' | 'published'
  /** ISO 8601 */
  updatedAt: string
}

export interface DocSection {
  key: string
  title: string
  description: string
  order: number
}

/** Entrada liviana para navegación: sin el body. */
export type DocNavItem = Pick<DocPage, 'slug' | 'section' | 'kind' | 'title' | 'description' | 'order'>

export interface DocNavGroup {
  section: DocSection
  items: DocNavItem[]
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
