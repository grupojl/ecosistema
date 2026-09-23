import { describe, it, expect } from 'vitest'
import { resolveCheckoutLocale } from './resolve-checkout-locale'

describe('resolveCheckoutLocale', () => {
  it('un locale explícito válido gana sobre el recordado', () => {
    expect(resolveCheckoutLocale('fr', 'es')).toBe('fr')
  })

  it('sin explícito, usa el recordado (última tienda navegada)', () => {
    expect(resolveCheckoutLocale(undefined, 'pt')).toBe('pt')
    expect(resolveCheckoutLocale(null, 'pt')).toBe('pt')
  })

  it('un explícito inválido (no está en LOCALES) se ignora, cae al recordado', () => {
    expect(resolveCheckoutLocale('klingon', 'de')).toBe('de')
  })

  it('sin ninguno de los dos → undefined, nunca inventa un idioma', () => {
    expect(resolveCheckoutLocale(undefined, undefined)).toBeUndefined()
    expect(resolveCheckoutLocale(null, null)).toBeUndefined()
  })

  it('recordado inválido y sin explícito → undefined', () => {
    expect(resolveCheckoutLocale(undefined, 'klingon')).toBeUndefined()
  })
})
