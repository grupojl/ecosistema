import { describe, it, expect } from 'vitest'
import { parseAcceptLanguage, matchLocale, isLikelyCrawler, negotiateLocale } from '@/lib/i18n/negotiate'

describe('parseAcceptLanguage', () => {
  it('ordena por q-value descendente', () => {
    const tags = parseAcceptLanguage('en;q=0.5, pt;q=0.9, es')
    expect(tags.map((t) => t.tag)).toEqual(['es', 'pt', 'en'])
  })

  it('empate en q-value conserva el orden original del header', () => {
    const tags = parseAcceptLanguage('fr;q=0.8, de;q=0.8')
    expect(tags.map((t) => t.tag)).toEqual(['fr', 'de'])
  })

  it('descarta q=0 y el comodín *', () => {
    const tags = parseAcceptLanguage('es;q=0, *;q=0.1, pt')
    expect(tags.map((t) => t.tag)).toEqual(['pt'])
  })

  it('header vacío o ausente → []', () => {
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
  })

  it('trunca headers abusivamente largos (defensa DoS)', () => {
    const huge = Array.from({ length: 200 }, () => 'es-AR').join(',')
    expect(() => parseAcceptLanguage(huge)).not.toThrow()
  })
})

describe('matchLocale', () => {
  it('matchea por subtag primario: pt-BR → pt', () => {
    expect(matchLocale(parseAcceptLanguage('pt-BR'))).toBe('pt')
  })

  it('sin match entre los locales soportados → null', () => {
    expect(matchLocale(parseAcceptLanguage('ja-JP, ko-KR'))).toBeNull()
  })
})

describe('isLikelyCrawler', () => {
  it('detecta Googlebot', () => {
    expect(isLikelyCrawler('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
  })

  it('un navegador normal no es crawler', () => {
    expect(isLikelyCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })

  it('sin user-agent → no es crawler', () => {
    expect(isLikelyCrawler(null)).toBe(false)
    expect(isLikelyCrawler(undefined)).toBe(false)
  })
})

describe('negotiateLocale — orden de prioridad (ADR-016 D2)', () => {
  it('1. cookie explícita gana sobre todo lo demás', () => {
    const result = negotiateLocale({
      cookieLocale: 'en',
      acceptLanguage: 'es-AR',
      countryCode: 'AR',
    })
    expect(result).toEqual({ locale: 'en', source: 'cookie' })
  })

  it('2. sin cookie, Accept-Language gana sobre el país', () => {
    // Brasileño de visita en Argentina: navegador en pt, IP de AR.
    const result = negotiateLocale({
      acceptLanguage: 'pt-BR',
      countryCode: 'AR',
    })
    expect(result).toEqual({ locale: 'pt', source: 'accept-language' })
  })

  it('3. sin cookie ni Accept-Language útil, decide el país', () => {
    const result = negotiateLocale({ countryCode: 'BR' })
    expect(result).toEqual({ locale: 'pt', source: 'country' })
  })

  it('4. un crawler nunca usa la señal país (evita que todo termine en /en)', () => {
    const result = negotiateLocale({
      countryCode: 'US',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    })
    expect(result).toEqual({ locale: 'es', source: 'default' })
  })

  it('5. sin ninguna señal → DEFAULT_LOCALE', () => {
    expect(negotiateLocale({})).toEqual({ locale: 'es', source: 'default' })
  })

  it('país inválido o sin mapeo → cae al default, no revienta', () => {
    expect(negotiateLocale({ countryCode: 'XX' })).toEqual({ locale: 'es', source: 'default' })
  })
})
