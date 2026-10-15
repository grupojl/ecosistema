/**
 * Configuración del repositorio de docs. Solo servidor: ninguna variable lleva
 * NEXT_PUBLIC_, la clave interna nunca llega al navegador.
 */
export interface DocsEnv {
  /** Base de grupojl-control-backend, sin barra final. */
  backendUrl: string
  internalApiKey: string
  /** Ecosistema que sirve este deploy (ADR-021). */
  ecosystemId: string
}

export function getDocsEnv(): DocsEnv {
  const backendUrl = process.env.DOCS_BACKEND_URL?.replace(/\/+$/, '')
  const internalApiKey = process.env.INTERNAL_API_KEY
  if (!backendUrl) throw new Error('[docs] falta DOCS_BACKEND_URL')
  if (!internalApiKey) throw new Error('[docs] falta INTERNAL_API_KEY')
  return { backendUrl, internalApiKey, ecosystemId: process.env.DOCS_ECOSYSTEM_ID ?? 'welver' }
}

/** Tag de caché de un ecosistema; superadmin lo invalida al publicar (docs-internal.md). */
export function docsTag(ecosystemId: string): string {
  return `docs:${ecosystemId}`
}
