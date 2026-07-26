// lib/store/resolver.ts
//
// Resuelve slug → StoreInfo llamando al endpoint público del back.
// Este resultado se puede cachear en el servidor (Next.js fetch cache).
//
// Por qué NO usamos NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID:
//   En el modelo multi-tenant cada slug es una tienda distinta.
//   El organizationId se obtiene dinámicamente en runtime.

import type { StoreInfo } from './types'

const API_URL = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL

export async function resolveStore(slug: string): Promise<StoreInfo | null> {
  if (!API_URL) {
    console.error('[store] Falta NEXT_PUBLIC_ECOMMERCE_API_URL en .env.local')
    return null
  }

  try {
    const res = await fetch(
      `${API_URL}/ecommerce/public/by-slug/${encodeURIComponent(slug)}`,
      {
        // Cache 5 minutos en el servidor — el slug no cambia frecuentemente
        next: { revalidate: 300 },
      },
    )

    if (res.status === 404) return null
    if (!res.ok) {
      console.error(`[store] by-slug respondió ${res.status} para slug "${slug}"`)
      return null
    }

    return (await res.json()) as StoreInfo
  } catch (err) {
    console.error('[store] Error resolviendo slug:', err)
    return null
  }
}
