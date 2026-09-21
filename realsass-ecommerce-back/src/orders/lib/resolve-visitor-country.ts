import type { Request } from 'express'

/**
 * Detecta el país del visitante por orden de precedencia.
 * Retorna un código ISO 3166-1 alpha-2 en UPPERCASE, o null para fallback al default.
 *
 * Precedencia:
 *   1. Header X-Visitor-Country  (selección explícita del usuario en el front)
 *   2. Header CF-IPCountry       (Cloudflare CDN)
 *   3. Header X-Forwarded-Country (proxy propio)
 *   4. null → ecommerce-back usa el Market default de la org
 */
export function resolveVisitorCountry(request: Request): string | null {
  const explicit = request.headers['x-visitor-country']
  if (explicit && typeof explicit === 'string' && explicit.length === 2) {
    return explicit.toUpperCase()
  }

  const cloudflare = request.headers['cf-ipcountry']
  if (cloudflare && typeof cloudflare === 'string' && cloudflare !== 'T1' && cloudflare.length === 2) {
    return cloudflare.toUpperCase()
  }

  const forwarded = request.headers['x-forwarded-country']
  if (forwarded && typeof forwarded === 'string' && forwarded.length === 2) {
    return forwarded.toUpperCase()
  }

  return null // → resolveMarket usará el Market default
}
