import { describe, it, expect } from 'vitest'
import { worldLanguageForCountry, WORLD_LANGUAGE_BY_COUNTRY, MULTILINGUAL_COUNTRIES } from '@/lib/i18n/countries'

describe('worldLanguageForCountry', () => {
  it('devuelve el idioma dominante para países bien conocidos', () => {
    expect(worldLanguageForCountry('AR')).toBe('es')
    expect(worldLanguageForCountry('BR')).toBe('pt')
    expect(worldLanguageForCountry('FR')).toBe('fr')
    expect(worldLanguageForCountry('DE')).toBe('de')
  })

  it('reconoce idiomas que todavía no tienen diccionario activo (dato factual, no producto)', () => {
    expect(worldLanguageForCountry('JP')).toBe('ja')
    expect(worldLanguageForCountry('SA')).toBe('ar')
    expect(worldLanguageForCountry('CN')).toBe('zh')
  })

  it('normaliza minúsculas y espacios', () => {
    expect(worldLanguageForCountry(' jp ')).toBe('ja')
  })

  it('países multilingües (regla IKEA) devuelven null a propósito, no un idioma incorrecto', () => {
    expect(worldLanguageForCountry('CA')).toBeNull()
    expect(worldLanguageForCountry('CH')).toBeNull()
    expect(worldLanguageForCountry('IN')).toBeNull()
    expect(worldLanguageForCountry('ZA')).toBeNull()
  })

  it('país inexistente o vacío → null, no revienta', () => {
    expect(worldLanguageForCountry('ZZ')).toBeNull()
    expect(worldLanguageForCountry(null)).toBeNull()
    expect(worldLanguageForCountry('')).toBeNull()
  })
})

describe('integridad de la tabla mundial', () => {
  it('no tiene países multilingües mapeados por accidente (serían un idioma incorrecto silencioso)', () => {
    for (const country of MULTILINGUAL_COUNTRIES) {
      expect(WORLD_LANGUAGE_BY_COUNTRY[country]).toBeUndefined()
    }
  })

  it('todos los códigos de país son alpha-2 en mayúsculas (o XK, de facto)', () => {
    const codes = Object.keys(WORLD_LANGUAGE_BY_COUNTRY)
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('todos los códigos de idioma son ISO 639-1 (2 letras minúsculas)', () => {
    const langs = Object.values(WORLD_LANGUAGE_BY_COUNTRY)
    for (const lang of langs) {
      expect(lang).toMatch(/^[a-z]{2}$/)
    }
  })

  it('cobertura amplia: más de 150 países mapeados (antes había ~35)', () => {
    expect(Object.keys(WORLD_LANGUAGE_BY_COUNTRY).length).toBeGreaterThan(150)
  })
})
