import type { NextRequest } from 'next/server'

/**
 * Detecta el país del visitante en un NextRequest (server-side).
 * Retorna un código ISO 3166-1 alpha-2 en UPPERCASE, o 'default' para que
 * el backend use el Market default de la organización.
 */
export function resolveVisitorCountry(request: NextRequest): string {
  const explicit = request.headers.get('x-visitor-country')
  if (explicit && explicit.length === 2) return explicit.toUpperCase()

  const cloudflare = request.headers.get('cf-ipcountry')
  if (cloudflare && cloudflare !== 'T1' && cloudflare.length === 2) return cloudflare.toUpperCase()

  return 'default'
}
