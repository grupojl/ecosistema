import { describe, it, expect } from 'vitest'
import { t, plural, getDictionary, LOCALES } from './index'

describe('t (interpolación)', () => {
  it('reemplaza placeholders conocidos', () => {
    expect(t('Hola {name}', { name: 'Mundo' })).toBe('Hola Mundo')
  })

  it('deja intacto un placeholder sin valor (visible en QA, no rompe)', () => {
    expect(t('Hola {name}', {})).toBe('Hola {name}')
  })

  it('interpola números', () => {
    expect(t('Página {page}', { page: 3 })).toBe('Página 3')
  })
})

describe('plural (Intl.PluralRules — reglas CLDR reales)', () => {
  const forms = { one: '{count} producto', other: '{count} productos' }

  it('es: 1 → singular, 0 y 2+ → plural', () => {
    expect(plural('es', 1, forms)).toBe('1 producto')
    expect(plural('es', 0, forms)).toBe('0 productos')
    expect(plural('es', 5, forms)).toBe('5 productos')
  })

  it('pt: a diferencia de es, la regla CLDR de "pt" trata 0 como singular (no n === 1)', () => {
    // Esto es justamente por lo que Intl.PluralRules existe en vez de un
    // `n === 1` manual: la regla varía por idioma y "pt" no es "pt-PT".
    expect(plural('pt', 0, forms)).toBe('0 producto')
    expect(plural('pt', 1, forms)).toBe('1 producto')
    expect(plural('pt', 2, forms)).toBe('2 productos')
  })
})

describe('getDictionary', () => {
  it('devuelve un diccionario completo para cada locale soportado', () => {
    for (const locale of LOCALES) {
      const dict = getDictionary(locale)
      expect(dict.nav.home).toBeTruthy()
      expect(dict.catalog.productCount.one).toBeTruthy()
      expect(dict.catalog.productCount.other).toBeTruthy()
    }
  })
})
