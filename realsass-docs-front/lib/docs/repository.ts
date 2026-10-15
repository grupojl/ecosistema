import type { DocNavGroup, DocPage, Locale } from './types'

/**
 * Única puerta de entrada al contenido. Los componentes y las rutas dependen de esta
 * interfaz; en F1 se reemplaza la implementación por el tRPC server caller (`docs.*`)
 * sin tocar ninguna página.
 *
 * Contrato de errores (ADR-016): una página inexistente devuelve `null` (→ 404);
 * cualquier otra falla debe lanzar (→ 5xx, así Google conserva el índice).
 */
export interface DocsRepository {
  /** Árbol de navegación con solo páginas `published`. */
  getNavigation(locale: Locale): Promise<DocNavGroup[]>
  /** Página `published` o `null` si no existe. */
  getPage(locale: Locale, slug: string): Promise<DocPage | null>
}
