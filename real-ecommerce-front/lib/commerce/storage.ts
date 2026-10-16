/**
 * lib/commerce/storage.ts — carrito y sesión de la bolsa, POR TIENDA. PURO.
 *
 * Cada organización tiene su propio cliente (ADR-021: único por organización + email) y su propio carrito, así que las
 * claves de localStorage llevan el organizationId. La IDENTIDAD ya no se guarda acá: la mantiene Firebase.
 */
export interface CustomerSession {
  uid:      string
  email:    string
  name:     string | null
  photoUrl: string | null
}

export const cartKey    = (organizationId: string) => `store:${organizationId}:cartId`
export const sessionKey = (organizationId: string) => `store:${organizationId}:sessionId`

export function newSessionId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  return g.crypto?.randomUUID?.() ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/** "Ana María López" → "AL"; sin nombre, las dos primeras letras del email. */
export function initialsOf(customer: Pick<CustomerSession, 'email' | 'name'>): string {
  const name = customer.name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase()
  }
  return customer.email.slice(0, 2).toUpperCase()
}
