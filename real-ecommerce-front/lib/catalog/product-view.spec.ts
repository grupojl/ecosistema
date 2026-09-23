import { describe, it, expect } from 'vitest'
import { availableUnits, toProductView, formatPrice, paginate, parsePageParam, type ProductLike } from './product-view'

const baseProduct: ProductLike = {
  id: 'p1',
  name: 'Zapatilla Urbana',
  handle: 'zapatilla-urbana',
  description: 'Cómoda para el día a día',
  updatedAt: '2026-09-20T12:00:00.000Z',
  category: { id: 'c1', name: 'Calzado', handle: 'calzado' },
  variants: [
    { id: 'v1', title: '40', priceCents: 15000, currency: 'ARS', inventory: { quantityAvailable: 10, quantityReserved: 3 } },
    { id: 'v2', title: '41', priceCents: 16000, currency: 'ARS', inventory: { quantityAvailable: 2, quantityReserved: 2 } },
  ],
}

describe('availableUnits', () => {
  it('resta reservado de disponible', () => {
    expect(availableUnits({ quantityAvailable: 10, quantityReserved: 3 })).toBe(7)
  })

  it('nunca da negativo aunque el dato esté corrupto', () => {
    expect(availableUnits({ quantityAvailable: 1, quantityReserved: 5 })).toBe(0)
  })

  it('sin inventario → 0', () => {
    expect(availableUnits(null)).toBe(0)
  })
})

describe('toProductView', () => {
  it('calcula el rango de precio sobre la moneda de la primera variante', () => {
    const view = toProductView(baseProduct)
    expect(view.currency).toBe('ARS')
    expect(view.minPriceCents).toBe(15000)
    expect(view.maxPriceCents).toBe(16000)
  })

  it('inStock es true si al menos una variante tiene unidades disponibles', () => {
    expect(toProductView(baseProduct).inStock).toBe(true)
    expect(toProductView(baseProduct).variants[1].available).toBe(false) // v2: 2-2=0
  })

  it('mezclar monedas entre variantes no contamina el rango de precio', () => {
    const mixed: ProductLike = {
      ...baseProduct,
      variants: [
        ...baseProduct.variants,
        { id: 'v3', title: '42', priceCents: 5, currency: 'USD', inventory: null },
      ],
    }
    const view = toProductView(mixed)
    // El precio en USD no debe colarse en el min/max de ARS.
    expect(view.currency).toBe('ARS')
    expect(view.minPriceCents).toBe(15000)
    expect(view.maxPriceCents).toBe(16000)
  })

  it('sin variantes → sin precio, sin stock, sin reventar', () => {
    const view = toProductView({ ...baseProduct, variants: [] })
    expect(view.currency).toBeNull()
    expect(view.minPriceCents).toBeNull()
    expect(view.inStock).toBe(false)
  })

  it('updatedAt como string ISO se convierte a Date válida', () => {
    expect(toProductView(baseProduct).updatedAt).toBeInstanceOf(Date)
    expect(Number.isNaN(toProductView(baseProduct).updatedAt.getTime())).toBe(false)
  })

  it('updatedAt corrupta no revienta (fallback a epoch)', () => {
    const view = toProductView({ ...baseProduct, updatedAt: 'no-es-una-fecha' })
    expect(view.updatedAt.getTime()).toBe(0)
  })
})

describe('formatPrice', () => {
  it('formatea centavos sin reventar y conserva el monto', () => {
    // No se fija el separador exacto (',', '.') porque depende de los datos
    // ICU del runtime (Node small-icu vs full-icu); solo que el monto esté.
    const result = formatPrice(150000, 'ARS', 'es-AR')
    expect(result).toMatch(/1[.,]?500/)
  })

  it('moneda inválida no rompe el render (fallback a número plano)', () => {
    expect(() => formatPrice(1000, 'NOT_A_CURRENCY', 'es-AR')).not.toThrow()
    expect(formatPrice(1000, 'NOT_A_CURRENCY', 'es-AR')).toContain('10.00')
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)

  it('pagina correctamente en el medio del rango', () => {
    const page = paginate(items, 2, 10)
    expect(page?.items).toEqual(items.slice(10, 20))
    expect(page?.totalPages).toBe(3)
  })

  it('page fuera de rango → null (para que la página responda 404 real)', () => {
    expect(paginate(items, 0, 10)).toBeNull()
    expect(paginate(items, 4, 10)).toBeNull()
    expect(paginate(items, 1.5, 10)).toBeNull()
  })

  it('lista vacía: la página 1 es válida (totalPages mínimo 1)', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 })
  })
})

describe('parsePageParam', () => {
  it('sin query param → página 1', () => {
    expect(parsePageParam(undefined)).toBe(1)
    expect(parsePageParam('')).toBe(1)
  })

  it('número válido se parsea', () => {
    expect(parsePageParam('3')).toBe(3)
  })

  it('valores no numéricos → NaN (para que paginate() lo rechace y sea 404)', () => {
    expect(Number.isNaN(parsePageParam('abc'))).toBe(true)
    expect(Number.isNaN(parsePageParam('1.5'))).toBe(true)
    expect(Number.isNaN(parsePageParam('-1'))).toBe(true)
  })
})
