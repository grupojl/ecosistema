import { docsTag, getDocsEnv } from './env'
import type { DocsRepository } from './repository'
import type { DocNavGroup, DocPage, Locale } from './types'

/** Revalidación de respaldo si superadmin no pudo avisar (best-effort allá). */
const FALLBACK_REVALIDATE_SECONDS = 3600

/**
 * DocsRepository sobre `/internal/docs/*` de grupojl-control-backend
 * (superadmin/.claude/contracts/docs-internal.md).
 *
 * Contrato de errores (ADR-016): 404 → `null` (404 público). Cualquier otra falla
 * lanza → 5xx, para que Google conserve lo ya indexado.
 */
async function request(path: string): Promise<Response> {
  const { backendUrl, internalApiKey, ecosystemId } = getDocsEnv()
  return fetch(`${backendUrl}/internal/docs/${encodeURIComponent(ecosystemId)}/${path}`, {
    headers: { 'x-internal-api-key': internalApiKey },
    next: { tags: [docsTag(ecosystemId)], revalidate: FALLBACK_REVALIDATE_SECONDS },
  })
}

export const internalDocsRepository: DocsRepository = {
  async getNavigation(locale: Locale): Promise<DocNavGroup[]> {
    const res = await request(`${locale}/navigation`)
    if (!res.ok) throw new Error(`[docs] navigation ${locale} respondió ${res.status}`)
    return (await res.json()) as DocNavGroup[]
  },

  async getPage(locale: Locale, slug: string): Promise<DocPage | null> {
    const res = await request(`${locale}/page?slug=${encodeURIComponent(slug)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`[docs] page ${locale}/${slug} respondió ${res.status}`)
    return (await res.json()) as DocPage
  },
}
