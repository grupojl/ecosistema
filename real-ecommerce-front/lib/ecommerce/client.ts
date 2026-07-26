const ECOMMERCE_API_URL = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL
const ECOMMERCE_ORGANIZATION_ID = process.env.NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID

// Envelope estándar del ecosistema real — { success, data }, ver
// ResponseInterceptor en real-ecommerce-back.
interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * Fetch base contra los endpoints PÚBLICOS de real-ecommerce-back
 * (/ecommerce/public/:organizationId/...). Sin auth — son rutas @Public().
 *
 * NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID fija qué organización sirve este
 * storefront. Hoy 1 front = 1 organización, igual que el resto del
 * ecosistema (no hay resolución multi-tenant por dominio todavía).
 */
export async function ecommerceFetch<T>(path: string): Promise<T | null> {
  if (!ECOMMERCE_API_URL || !ECOMMERCE_ORGANIZATION_ID) {
    console.error(
      "[ecommerce] Faltan NEXT_PUBLIC_ECOMMERCE_API_URL o NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID en .env.local",
    )
    return null
  }

  try {
    const url = `${ECOMMERCE_API_URL}/ecommerce/public/${ECOMMERCE_ORGANIZATION_ID}${path}`
    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      console.error("[ecommerce] API error:", response.status, response.statusText, url)
      return null
    }

    const body = (await response.json()) as ApiEnvelope<T>
    return body.data
  } catch (error) {
    console.error("[ecommerce] Error de red contra real-ecommerce-back:", error)
    return null
  }
}

export { ECOMMERCE_API_URL, ECOMMERCE_ORGANIZATION_ID }
