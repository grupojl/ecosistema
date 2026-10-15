// Test de humo del storefront (DT-TEST-02).
//
// Ejecuta las páginas REALES (Server Components async) con el resolver y el cliente de catálogo
// reales; solo se reemplaza el server caller de tRPC (la red). El JSX resultante se renderiza a HTML
// con react-dom/server: no hace falta DOM ni dependencias nuevas.
//
// Qué atrapa: páginas contra un shape inexistente ("$NaN", links rotos), un throw al renderizar,
// y la semántica de errores del ADR-016 (NOT_FOUND => 404; cualquier otra falla => 5xx).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TRPCClientError } from '@trpc/client'

// React 19 exporta `cache` solo bajo la condición react-server; en el test es identidad.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, default: actual, cache: <T extends (...a: never[]) => unknown>(fn: T) => fn }
})

class NotFoundSignal extends Error {
  constructor() { super('NEXT_NOT_FOUND') }
}
vi.mock('next/navigation', () => ({
  notFound: () => { throw new NotFoundSignal() },
  usePathname: () => '/es/tienda/mi-tienda',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const resolveStoreQuery = vi.fn()
const getProductsQuery = vi.fn()
vi.mock('@/lib/trpc/server', () => ({
  createStoreCaller: () => ({
    customer: {
      resolveStore: { query: resolveStoreQuery },
      getProducts: { query: getProductsQuery },
    },
  }),
}))

import StorePage from './page'
import ProductosPage from './productos/page'
import StoreLayout from './layout'

const store = {
  organizationId: 'org-1',
  name: 'Mi Tienda',
  description: 'Lo mejor del barrio',
  countryCode: 'AR',
  logoUrl: null,
  website: null,
}

const product = (n: number, categoryName = 'Remeras') => ({
  id: `p-${n}`,
  name: `Producto ${n}`,
  handle: `producto-${n}`,
  description: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
  category: { id: 'c-1', name: categoryName, handle: categoryName.toLowerCase() },
  variants: [
    { id: `v-${n}`, title: 'Único', priceCents: 12_500, currency: 'ARS', inventory: { quantityAvailable: 5, quantityReserved: 0 } },
  ],
})

const trpcError = (code: string) =>
  new TRPCClientError(`error ${code}`, { result: { error: { message: code, code: -1, data: { code } } } as never })

const params = (slug = 'mi-tienda', locale = 'es') => Promise.resolve({ locale, slug })
const html = async (node: Promise<React.ReactNode> | React.ReactNode) => renderToStaticMarkup(await node)

describe('storefront — humo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveStoreQuery.mockResolvedValue(store)
    getProductsQuery.mockResolvedValue([product(1), product(2)])
  })

  describe('home de la tienda', () => {
    it('renderiza el nombre, la descripción, la categoría y los productos con precio y link válidos', async () => {
      const out = await html(StorePage({ params: params() }))

      expect(out).toContain('Mi Tienda')
      expect(out).toContain('Lo mejor del barrio')
      expect(out).toContain('Producto 1')
      expect(out).toContain('Producto 2')
      expect(out).toContain('Remeras')
      expect(out).toContain('/es/tienda/mi-tienda/productos/producto-1')
      expect(out).not.toContain('NaN')
      expect(out).not.toContain('undefined')
    })

    it('sin productos muestra el estado vacío, no una página rota', async () => {
      getProductsQuery.mockResolvedValue([])

      const out = await html(StorePage({ params: params() }))

      expect(out).toContain('Mi Tienda')
      expect(out).not.toContain('NaN')
    })

    it('tienda inexistente (NOT_FOUND) => 404', async () => {
      resolveStoreQuery.mockRejectedValue(trpcError('NOT_FOUND'))

      await expect(StorePage({ params: params('no-existe') })).rejects.toBeInstanceOf(NotFoundSignal)
    })

    it('caída del back => se relanza (5xx), NO 404: Google conserva el índice (ADR-016)', async () => {
      resolveStoreQuery.mockRejectedValue(trpcError('SERVICE_UNAVAILABLE'))

      const err: unknown = await StorePage({ params: params() }).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(TRPCClientError)
      expect(err).not.toBeInstanceOf(NotFoundSignal)
    })

    it('idioma inválido => 404 sin consultar al back', async () => {
      await expect(StorePage({ params: params('mi-tienda', 'xx') })).rejects.toBeInstanceOf(NotFoundSignal)
      expect(resolveStoreQuery).not.toHaveBeenCalled()
    })
  })

  describe('listado de productos', () => {
    it('renderiza los productos con precio formateado', async () => {
      const out = await html(ProductosPage({ params: params(), searchParams: Promise.resolve({}) }))

      expect(out).toContain('Producto 1')
      expect(out).toContain('Producto 2')
      expect(out).toMatch(/125/)
      expect(out).not.toContain('NaN')
    })

    it('página fuera de rango => 404 real, no soft-404', async () => {
      await expect(
        ProductosPage({ params: params(), searchParams: Promise.resolve({ page: '99' }) }),
      ).rejects.toBeInstanceOf(NotFoundSignal)
    })

    it('tienda inexistente => 404', async () => {
      resolveStoreQuery.mockRejectedValue(trpcError('NOT_FOUND'))

      await expect(
        ProductosPage({ params: params('no-existe'), searchParams: Promise.resolve({}) }),
      ).rejects.toBeInstanceOf(NotFoundSignal)
    })

    it('caída del back => 5xx', async () => {
      getProductsQuery.mockRejectedValue(trpcError('INTERNAL_SERVER_ERROR'))

      const err: unknown = await ProductosPage({ params: params(), searchParams: Promise.resolve({}) })
        .catch((e: unknown) => e)

      expect(err).toBeInstanceOf(TRPCClientError)
    })
  })

  describe('layout', () => {
    it('envuelve a los hijos con el header de la tienda, la navegación y el JSON-LD', async () => {
      const out = await html(StoreLayout({ children: <p>contenido-hijo</p>, params: params() }))

      expect(out).toContain('contenido-hijo')
      expect(out).toContain('Mi Tienda')
      expect(out).toContain('/es/tienda/mi-tienda/productos')
      expect(out).toContain('application/ld+json')
    })

    it('tienda inexistente => 404', async () => {
      resolveStoreQuery.mockRejectedValue(trpcError('NOT_FOUND'))

      await expect(
        StoreLayout({ children: <p>x</p>, params: params('no-existe') }),
      ).rejects.toBeInstanceOf(NotFoundSignal)
    })
  })
})
