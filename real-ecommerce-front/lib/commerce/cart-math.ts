/**
 * lib/commerce/cart-math.ts — totales de la bolsa. PURO.
 *
 * El precio se toma de la VARIANTE (`variant.priceCents`), no de `unitPriceCentsSnapshot`: el back guarda ese snapshot
 * en 0 al agregar al carrito, y el checkout también recalcula desde la variante. Mostrar lo mismo que se va a cobrar.
 */
export interface CartLineLike {
  variantId: string
  quantity:  number
  variant: {
    priceCents: number
    currency:   string
  }
}

export interface CartSummary {
  count:         number          // unidades totales
  subtotalCents: number
  currency:      string | null   // null si la bolsa está vacía
}

export function lineTotalCents(line: CartLineLike): number {
  return line.variant.priceCents * line.quantity
}

export function summarizeCart(lines: readonly CartLineLike[] | undefined | null): CartSummary {
  if (!lines || lines.length === 0) return { count: 0, subtotalCents: 0, currency: null }
  return {
    count:         lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: lines.reduce((sum, l) => sum + lineTotalCents(l), 0),
    // Una orden tiene una sola moneda (como el checkout del back): se usa la de la primera línea.
    currency:      lines[0]!.variant.currency,
  }
}

/** true si alguna línea está en otra moneda que la primera: el back cobraría todo en la primera. */
export function hasMixedCurrencies(lines: readonly CartLineLike[] | undefined | null): boolean {
  if (!lines || lines.length < 2) return false
  const first = lines[0]!.variant.currency
  return lines.some((l) => l.variant.currency !== first)
}
