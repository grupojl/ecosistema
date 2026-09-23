import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isLocale, localeFromCountry, primaryLocaleForCountry,
  intlLocale, openGraphLocale, isRtlLocale, LOCALES, RTL_LOCALES, DEFAULT_LOCALE,
} from './config'

describe('isLocale', () => {
  it('acepta los 5 locales activos', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true)
  })

  it('rechaza cualquier otro valor', () => {
    expect(isLocale('ja')).toBe(false) // idioma real, pero sin diccionario activo
    expect(isLocale('ES')).toBe(false) // case-sensitive
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('localeFromCountry (hot path de negociación — sin logging)', () => {
  it('mapea países con idioma activo', () => {
    expect(localeFromCountry('AR')).toBe('es')
    expect(localeFromCountry('BR')).toBe('pt')
    expect(localeFromCountry('FR')).toBe('fr')
    expect(localeFromCountry('DE')).toBe('de')
  })

  it('un país con idioma real pero SIN diccionario activo → null (no inventa un idioma)', () => {
    expect(localeFromCountry('JP')).toBeNull() // 'ja' existe en countries.ts, no en LOCALES
  })

  it('países multilingües → null', () => {
    expect(localeFromCountry('CA')).toBeNull()
  })
})

describe('primaryLocaleForCountry (indexabilidad — SÍ loguea cuando hay deuda accionable)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('país con idioma activo → ese idioma, sin logging', () => {
    expect(primaryLocaleForCountry('BR')).toBe('pt')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('país con idioma real pero inactivo (ej. Japón) → cae a DEFAULT_LOCALE Y loguea la deuda', () => {
    expect(primaryLocaleForCountry('JP')).toBe(DEFAULT_LOCALE)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('JP')
    expect(warnSpy.mock.calls[0][0]).toContain('ja')
  })

  it('país multilingüe (sin idioma dominante real) → cae a DEFAULT_LOCALE SIN logging (no es deuda, es ambigüedad esperada)', () => {
    expect(primaryLocaleForCountry('CA')).toBe(DEFAULT_LOCALE)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('país totalmente desconocido → cae a DEFAULT_LOCALE sin logging, nunca revienta', () => {
    expect(primaryLocaleForCountry('ZZ')).toBe(DEFAULT_LOCALE)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(() => primaryLocaleForCountry(null)).not.toThrow()
  })
})

describe('RTL (arquitectura lista, sin idiomas activos todavía)', () => {
  it('ningún locale activo es RTL hoy — es correcto, no hay diccionario ar/he activo', () => {
    expect(RTL_LOCALES).toEqual([])
    for (const locale of LOCALES) expect(isRtlLocale(locale)).toBe(false)
  })
})

describe('intlLocale / openGraphLocale', () => {
  it('combina locale + país en un tag BCP-47 válido', () => {
    expect(intlLocale('fr', 'FR')).toBe('fr-FR')
    expect(intlLocale('de', 'AT')).toBe('de-AT')
  })

  it('idioma de la URL puede diferir del país de la tienda', () => {
    expect(intlLocale('en', 'AR')).toBe('en-AR')
  })

  it('sin país o país inválido → solo el locale, no revienta', () => {
    expect(intlLocale('es', null)).toBe('es')
    expect(intlLocale('es', 'ARG')).toBe('es')
  })

  it('openGraphLocale usa guion bajo', () => {
    expect(openGraphLocale('pt', 'BR')).toBe('pt_BR')
  })
})
