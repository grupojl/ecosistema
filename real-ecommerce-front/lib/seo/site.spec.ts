import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSiteUrl, __resetSiteUrlCacheForTests, localizedPath, absoluteUrl, buildAlternates, robotsFor } from './site'

const ORIGINAL_SITE_URL = process.env['SITE_URL']

beforeEach(() => {
  __resetSiteUrlCacheForTests()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env['SITE_URL'] = ORIGINAL_SITE_URL
  vi.restoreAllMocks()
})

describe('getSiteUrl — fail-soft (ADR-016 D4)', () => {
  it('sin SITE_URL → null, no revienta', () => {
    delete process.env['SITE_URL']
    expect(getSiteUrl()).toBeNull()
  })

  it('SITE_URL inválida → null', () => {
    process.env['SITE_URL'] = 'no-es-una-url'
    expect(getSiteUrl()).toBeNull()
  })

  it('protocolo no http(s) → null (evita canonical a file:// etc.)', () => {
    process.env['SITE_URL'] = 'ftp://tienda.com'
    expect(getSiteUrl()).toBeNull()
  })

  it('SITE_URL válida se normaliza sin barra final', () => {
    process.env['SITE_URL'] = 'https://tienda.com/'
    expect(getSiteUrl()?.origin).toBe('https://tienda.com')
  })

  it('se cachea entre llamadas (no reparsea env en cada call)', () => {
    process.env['SITE_URL'] = 'https://tienda.com'
    const first = getSiteUrl()
    process.env['SITE_URL'] = 'https://otra.com' // no debería tomar efecto sin reset
    expect(getSiteUrl()).toBe(first)
  })
})

describe('localizedPath / absoluteUrl', () => {
  it('antepone el locale al path', () => {
    expect(localizedPath('pt', '/tienda/mi-marca')).toBe('/pt/tienda/mi-marca')
  })

  it('arma una URL absoluta contra el origin del sitio', () => {
    const site = new URL('https://tienda.com')
    expect(absoluteUrl(site, '/es/tienda/x')).toBe('https://tienda.com/es/tienda/x')
  })
})

describe('buildAlternates', () => {
  it('sin SITE_URL configurado → undefined (no canonical roto)', () => {
    delete process.env['SITE_URL']
    expect(buildAlternates({ path: '/tienda/x', currentLocale: 'es', indexableLocales: ['es'] })).toBeUndefined()
  })

  it('canonical es SIEMPRE self-referencial al locale actual', () => {
    process.env['SITE_URL'] = 'https://tienda.com'
    const alt = buildAlternates({ path: '/tienda/x', currentLocale: 'pt', indexableLocales: ['es', 'pt'] })
    expect(alt?.canonical).toBe('https://tienda.com/pt/tienda/x')
  })

  it('hreflang cubre solo los idiomas indexables + x-default', () => {
    process.env['SITE_URL'] = 'https://tienda.com'
    const alt = buildAlternates({ path: '/tienda/x', currentLocale: 'es', indexableLocales: ['es'] })
    const languages = alt?.languages as Record<string, string>
    expect(languages['es']).toBe('https://tienda.com/es/tienda/x')
    expect(languages['x-default']).toBe('https://tienda.com/tienda/x')
    expect(languages['pt']).toBeUndefined() // pt no es indexable para esta tienda
  })
})

describe('robotsFor', () => {
  it('idioma indexable → index,follow', () => {
    expect(robotsFor('es', ['es'])).toEqual({ index: true, follow: true })
  })

  it('idioma NO indexable (traducción de UI sin cobertura de contenido) → noindex,follow', () => {
    expect(robotsFor('en', ['es'])).toEqual({ index: false, follow: true })
  })
})
