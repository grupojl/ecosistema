import { describe, it, expect } from 'vitest'
import { cartKey, sessionKey, initialsOf, newSessionId } from '@/lib/commerce/storage'
import { summarizeCart, lineTotalCents, hasMixedCurrencies, type CartLineLike } from '@/lib/commerce/cart-math'

const line = (priceCents: number, quantity: number, currency = 'ARS'): CartLineLike => ({
  variantId: `v-${priceCents}`, quantity, variant: { priceCents, currency },
})

describe('claves por tienda', () => {
  it('llevan el organizationId: dos tiendas no comparten carrito ni sesión de bolsa', () => {
    expect(cartKey('org-a')).not.toBe(cartKey('org-b'))
    expect(sessionKey('org-a')).not.toBe(sessionKey('org-b'))
    expect(cartKey('org-a')).toContain('org-a')
  })

  it('la identidad ya no se guarda en localStorage (la mantiene Firebase, ADR-021)', () => {
    expect(cartKey('o')).not.toMatch(/customer/i)
    expect(sessionKey('o')).not.toMatch(/customer/i)
  })
})

describe('initialsOf', () => {
  it('nombre y apellido', () => expect(initialsOf({ email: 'x@y.co', name: 'Ana María López' })).toBe('AL'))
  it('un solo nombre', () => expect(initialsOf({ email: 'x@y.co', name: 'Ana' })).toBe('A'))
  it('sin nombre usa el email', () => expect(initialsOf({ email: 'beto@y.co', name: null })).toBe('BE'))
})

describe('newSessionId', () => {
  it('es no vacío y distinto cada vez', () => {
    expect(newSessionId()).toBeTruthy()
    expect(newSessionId()).not.toBe(newSessionId())
  })
})

describe('summarizeCart', () => {
  it('bolsa vacía o inexistente', () => {
    expect(summarizeCart([])).toEqual({ count: 0, subtotalCents: 0, currency: null })
    expect(summarizeCart(undefined)).toEqual({ count: 0, subtotalCents: 0, currency: null })
    expect(summarizeCart(null).count).toBe(0)
  })

  it('suma unidades y subtotal usando el precio de la variante', () => {
    const s = summarizeCart([line(1000, 2), line(550, 1)])
    expect(s).toEqual({ count: 3, subtotalCents: 2550, currency: 'ARS' })
  })

  it('lineTotalCents', () => expect(lineTotalCents(line(250, 4))).toBe(1000))

  it('detecta monedas mezcladas (el back cobra todo en la primera)', () => {
    expect(hasMixedCurrencies([line(100, 1, 'ARS'), line(100, 1, 'USD')])).toBe(true)
    expect(hasMixedCurrencies([line(100, 1), line(200, 3)])).toBe(false)
    expect(hasMixedCurrencies([line(100, 1)])).toBe(false)
  })
})
