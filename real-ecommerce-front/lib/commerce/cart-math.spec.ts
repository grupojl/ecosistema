import { describe, expect, it } from 'vitest'
import { hasMixedCurrencies, lineTotalCents, summarizeCart, type CartLineLike } from './cart-math'

const line = (priceCents: number, quantity: number, currency = 'ARS'): CartLineLike => ({
  variantId: `v-${priceCents}-${currency}`, quantity, variant: { priceCents, currency },
})

describe('lineTotalCents', () => {
  it('precio de la variante × cantidad', () => {
    expect(lineTotalCents(line(1500, 3))).toBe(4500)
  })
  it('cantidad 0 → 0', () => {
    expect(lineTotalCents(line(1500, 0))).toBe(0)
  })
})

describe('summarizeCart', () => {
  it('bolsa vacía, nula o indefinida → ceros y moneda null', () => {
    const vacia = { count: 0, subtotalCents: 0, currency: null }
    expect(summarizeCart([])).toEqual(vacia)
    expect(summarizeCart(null)).toEqual(vacia)
    expect(summarizeCart(undefined)).toEqual(vacia)
  })

  it('suma unidades y subtotal', () => {
    expect(summarizeCart([line(1000, 2), line(250, 4)])).toEqual({ count: 6, subtotalCents: 3000, currency: 'ARS' })
  })

  it('la moneda es la de la primera línea (como el checkout del back)', () => {
    expect(summarizeCart([line(100, 1, 'USD'), line(100, 1, 'ARS')]).currency).toBe('USD')
  })

  it('trabaja en centavos enteros (sin errores de coma flotante)', () => {
    // 3 × 0,10 en flotante da 0,30000000000000004; en centavos es exacto
    expect(summarizeCart([line(10, 3)]).subtotalCents).toBe(30)
  })
})

describe('hasMixedCurrencies', () => {
  it('menos de 2 líneas → false', () => {
    expect(hasMixedCurrencies([])).toBe(false)
    expect(hasMixedCurrencies(null)).toBe(false)
    expect(hasMixedCurrencies([line(1, 1)])).toBe(false)
  })
  it('misma moneda → false', () => {
    expect(hasMixedCurrencies([line(1, 1), line(2, 1)])).toBe(false)
  })
  it('alguna distinta de la primera → true, aunque no sea la segunda', () => {
    expect(hasMixedCurrencies([line(1, 1), line(2, 1), line(3, 1, 'USD')])).toBe(true)
  })
})
