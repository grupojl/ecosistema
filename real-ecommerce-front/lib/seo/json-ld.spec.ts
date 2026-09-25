import { describe, it, expect } from 'vitest'
import { storeJsonLd, productJsonLd, breadcrumbJsonLd, serializeJsonLd } from '@/lib/seo/json-ld'
import { toProductView, type ProductLike } from '@/lib/catalog/product-view'

const product: ProductLike = {
  id: 'p1',
  name: 'Zapatilla Urbana',
  handle: 'zapatilla-urbana',
  description: 'Cómoda',
  updatedAt: '2026-09-20T12:00:00.000Z',
  category: { id: 'c1', name: 'Calzado', handle: 'calzado' },
  variants: [
    { id: 'v1', title: '40', priceCents: 15000, currency: 'ARS', inventory: { quantityAvailable: 5, quantityReserved: 0 } },
  ],
}

describe('storeJsonLd', () => {
  it('genera un OnlineStore con los campos básicos', () => {
    const ld = storeJsonLd({ name: 'Mi Marca', url: '/es/tienda/mi-marca', description: 'desc', logoUrl: null, website: null })
    expect(ld['@type']).toBe('OnlineStore')
    expect(ld.name).toBe('Mi Marca')
  })
})

describe('productJsonLd', () => {
  it('un único precio → Offer simple', () => {
    const view = toProductView(product)
    const ld = productJsonLd({ product: view, url: '/es/tienda/x/productos/y', storeName: 'Mi Marca', inLanguage: 'es' })
    expect((ld.offers as any // @real/jsonb-cast)['@type']).toBe('Offer')
    expect((ld.offers as any // @real/jsonb-cast).price).toBe('150.00')
    expect((ld.offers as any // @real/jsonb-cast).availability).toContain('InStock')
  })

  it('rango de precio (variantes distintas) → AggregateOffer', () => {
    const withRange: ProductLike = {
      ...product,
      variants: [
        ...product.variants,
        { id: 'v2', title: '41', priceCents: 16000, currency: 'ARS', inventory: { quantityAvailable: 1, quantityReserved: 0 } },
      ],
    }
    const view = toProductView(withRange)
    const ld = productJsonLd({ product: view, url: '/x', storeName: 'Mi Marca', inLanguage: 'es' })
    expect((ld.offers as any // @real/jsonb-cast)['@type']).toBe('AggregateOffer')
    expect((ld.offers as any // @real/jsonb-cast).lowPrice).toBe('150.00')
    expect((ld.offers as any // @real/jsonb-cast).highPrice).toBe('160.00')
  })

  it('sin stock → availability OutOfStock', () => {
    const outOfStock: ProductLike = {
      ...product,
      variants: [{ id: 'v1', title: '40', priceCents: 15000, currency: 'ARS', inventory: { quantityAvailable: 0, quantityReserved: 0 } }],
    }
    const ld = productJsonLd({ product: toProductView(outOfStock), url: '/x', storeName: 'Mi Marca', inLanguage: 'es' })
    expect((ld.offers as any // @real/jsonb-cast).availability).toContain('OutOfStock')
  })

  it('sin variantes → sin offers, no revienta', () => {
    const noVariants = toProductView({ ...product, variants: [] })
    const ld = productJsonLd({ product: noVariants, url: '/x', storeName: 'Mi Marca', inLanguage: 'es' })
    expect(ld.offers).toBeUndefined()
  })
})

describe('breadcrumbJsonLd', () => {
  it('arma un BreadcrumbList con posiciones 1-based', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Inicio', url: '/es/tienda/x' },
      { name: 'Calzado', url: '/es/tienda/x/categoria/calzado' },
    ])
    const items = ld.itemListElement as any // @real/jsonb-cast[]
    expect(items[0].position).toBe(1)
    expect(items[1].position).toBe(2)
  })
})

describe('serializeJsonLd — escape anti-XSS (CRÍTICO: nombre de producto es input del tenant)', () => {
  it('escapa </script> para que no cierre el tag y inyecte HTML/JS', () => {
    const malicious = { name: '</script><script>alert(1)</script>' }
    const serialized = serializeJsonLd(malicious)
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c/script\\u003e')
  })

  it('escapa < > & por separado', () => {
    const serialized = serializeJsonLd({ a: '<b>&"quoted"</b>' })
    expect(serialized).not.toContain('<b>')
    expect(serialized).toContain('\\u003c')
    expect(serialized).toContain('\\u003e')
    expect(serialized).toContain('\\u0026')
  })

  it('escapa separadores de línea U+2028/U+2029 (rompen JS embebido si no se escapan)', () => {
    const serialized = serializeJsonLd({ a: '\u2028\u2029' })
    expect(serialized).toContain('\\u2028')
    expect(serialized).toContain('\\u2029')
  })

  it('el resultado sigue siendo JSON válido tras des-escapar la porción JS', () => {
    const original = { name: 'Producto normal', price: 100 }
    const serialized = serializeJsonLd(original)
    // Sin caracteres peligrosos, el contenido semántico debe sobrevivir intacto.
    expect(JSON.parse(serialized)).toEqual(original)
  })
})
