import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { storePathWithLocale } from '@/lib/i18n/store-path'
import { LOCALES } from '@/lib/i18n/config'

describe('storePathWithLocale (ADR-022: /{locale}/{slug}, sin /tienda)', () => {
  it('agrega el idioma delante del slug', () => {
    expect(storePathWithLocale('/mi-marca', 'es')).toBe('/es/mi-marca')
    expect(storePathWithLocale('/mi-marca/productos/zapatilla', 'pt')).toBe('/pt/mi-marca/productos/zapatilla')
  })

  it('un link viejo con /tienda se traduce a la URL nueva', () => {
    expect(storePathWithLocale('/tienda/mi-marca', 'en')).toBe('/en/mi-marca')
    expect(storePathWithLocale('/tienda/mi-marca/categoria/calzado', 'es')).toBe('/es/mi-marca/categoria/calzado')
  })

  it('"tienda" dentro de un slug NO se toca (solo el prefijo exacto)', () => {
    expect(storePathWithLocale('/tienda-de-ana-1234', 'es')).toBe('/es/tienda-de-ana-1234')
    expect(storePathWithLocale('/tienda-de-ana-1234/productos', 'es')).toBe('/es/tienda-de-ana-1234/productos')
  })
})

describe('matcher del proxy', () => {
  const source = readFileSync(join(__dirname, '../../proxy.ts'), 'utf8')
  const matcher = source.slice(source.indexOf('matcher:'))

  it('excluye cada idioma de LOCALES (una URL con idioma nunca se redirige)', () => {
    for (const locale of LOCALES) expect(matcher).toContain(locale)
  })

  it('excluye las rutas fijas de app/ (checkout, tracking, sitemaps, categoria, products)', () => {
    for (const fixed of ['checkout', 'tracking', 'sitemaps', 'categoria/', 'products/', 'robots']) expect(matcher).toContain(fixed)
  })

  it('cada carpeta de primer nivel con página propia en app/ está excluida o es un grupo/dinámica', () => {
    const appDir = join(__dirname, '../../app')
    const topLevel = readdirSync(appDir).filter((n) => statSync(join(appDir, n)).isDirectory())
    const known = new Set(['[locale]', '(site)', 'sitemaps'])
    const unexpected = topLevel.filter((n) => !known.has(n))
    expect(unexpected).toEqual([]) // si aparece una carpeta nueva, hay que decidir si el proxy debe excluirla
  })
})
