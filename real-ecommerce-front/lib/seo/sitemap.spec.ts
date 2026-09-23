import { describe, it, expect } from 'vitest'
import { escapeXml, buildSitemapXml, SITEMAP_MAX_URLS, type SitemapEntry } from './sitemap'

describe('escapeXml', () => {
  it('escapa los 5 caracteres especiales de XML', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;')
  })

  it('texto sin caracteres especiales queda igual', () => {
    expect(escapeXml('zapatilla-urbana')).toBe('zapatilla-urbana')
  })
})

describe('buildSitemapXml', () => {
  it('genera un urlset válido con namespace xhtml (necesario para hreflang)', () => {
    const xml = buildSitemapXml([])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  })

  it('incluye loc, lastmod y los alternates hreflang de cada entrada', () => {
    const entries: SitemapEntry[] = [
      {
        loc: 'https://tienda.com/es/tienda/x',
        lastmod: new Date('2026-09-20T00:00:00.000Z'),
        alternates: [{ hreflang: 'es', href: 'https://tienda.com/es/tienda/x' }],
      },
    ]
    const xml = buildSitemapXml(entries)
    expect(xml).toContain('<loc>https://tienda.com/es/tienda/x</loc>')
    expect(xml).toContain('<lastmod>2026-09-20T00:00:00.000Z</lastmod>')
    expect(xml).toContain('hreflang="es"')
  })

  it('omite <lastmod> si la fecha es inválida (epoch/NaN) en vez de escribir basura', () => {
    const xml = buildSitemapXml([{ loc: 'https://tienda.com/x', lastmod: new Date(0), alternates: [] }])
    expect(xml).not.toContain('<lastmod>')
  })

  it('escapa el contenido de loc y href (defensa por si un slug trae caracteres raros)', () => {
    const xml = buildSitemapXml([{ loc: 'https://tienda.com/x?a=1&b=2', alternates: [] }])
    expect(xml).toContain('a=1&amp;b=2')
    expect(xml).not.toContain('a=1&b=2')
  })

  it('respeta el tope de 50.000 URLs del protocolo sitemaps.org', () => {
    const many: SitemapEntry[] = Array.from({ length: SITEMAP_MAX_URLS + 10 }, (_, i) => ({
      loc: `https://tienda.com/${i}`,
      alternates: [],
    }))
    const xml = buildSitemapXml(many)
    const count = (xml.match(/<url>/g) ?? []).length
    expect(count).toBe(SITEMAP_MAX_URLS)
  })
})
