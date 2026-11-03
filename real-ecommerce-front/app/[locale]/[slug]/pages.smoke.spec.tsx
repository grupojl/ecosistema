/**
 * Smoke del storefront (DT-TEST-02): renderiza las páginas REALES (Server Components) de punta a punta con un tRPC
 * simulado — resolver de tienda, catálogo, i18n, SEO y @real/ui — y comprueba HTML, 404 y fallas del back.
 *
 * Por qué existe: 4 páginas llamaban a `useStore()` (un hook de contexto de cliente) desde Server Components y rompían
 * con "Attempted to call useStore() from the server"; ni el typecheck ni los tests puros lo detectaban.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TRPCClientError } from '@trpc/client'

// La primera carga de las páginas importa Next + el barrel de @real/ui: bajo carga paralela supera los 5 s por defecto.
vi.setConfig({ testTimeout: 30_000 })

const STORE = {
  organizationId: 'org-1', slug: 'mi-tienda', name: 'Mi Tienda', description: 'La mejor tienda',
  countryCode: 'AR', logoUrl: null, website: null, ecommerceEnabled: true,
}
const PRODUCT = {
  id: 'p1', name: 'Zapatilla Urbana', handle: 'zapatilla-urbana', description: 'Cómoda y liviana',
  updatedAt: '2026-10-01T00:00:00.000Z', category: { id: 'c1', name: 'Calzado', handle: 'calzado' },
  variants: [{ id: 'v1', title: 'Talle 40', priceCents: 1000000, currency: 'ARS', inventory: { quantityAvailable: 5, quantityReserved: 0 } }],
}

const caller = {
  customer: {
    resolveStore: { query: vi.fn() },
    getProducts: { query: vi.fn() },
    getProduct: { query: vi.fn() },
  },
}
vi.mock('@/lib/trpc/server', () => ({ createStoreCaller: () => caller }))
// Componentes de cliente que dependen del CommerceProvider (Firebase, carrito): fuera del alcance del smoke de servidor.
vi.mock('@/components/commerce/add-to-cart', () => ({ AddToCart: () => <button>Agregar</button> }))

const notFoundError = () =>
  new TRPCClientError('not found', { result: { error: { data: { code: 'NOT_FOUND' } } } } as never)
const serverError = () =>
  new TRPCClientError('boom', { result: { error: { data: { code: 'INTERNAL_SERVER_ERROR' } } } } as never)

/** notFound() de Next lanza un error con digest NEXT_HTTP_ERROR_FALLBACK;404. */
async function expect404(promise: Promise<unknown>) {
  const err = await promise.then(() => null, (e: unknown) => e)
  expect(err, 'debía llamar a notFound()').not.toBeNull()
  expect(String((err as { digest?: string }).digest)).toContain('404')
}

const params = (over: Record<string, string> = {}) => Promise.resolve({ locale: 'es', slug: 'mi-tienda', ...over })

beforeEach(() => {
  vi.clearAllMocks()
  caller.customer.resolveStore.query.mockResolvedValue(STORE)
  caller.customer.getProducts.query.mockResolvedValue([PRODUCT])
  caller.customer.getProduct.query.mockResolvedValue(PRODUCT)
})

// `cache()` de React deduplica por request; en tests cada caso necesita importar el módulo limpio.
async function load<T>(path: string): Promise<T> {
  vi.resetModules()
  return (await import(/* @vite-ignore */ path)) as T
}

describe('home de la tienda', () => {
  it('renderiza marca, productos destacados y categorías con datos reales', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./page')
    const html = renderToStaticMarkup(await Page({ params: params() } as never))
    expect(html).toContain('Mi Tienda')
    expect(html).toContain('Zapatilla Urbana')
    expect(html).toContain('/es/mi-tienda/productos/zapatilla-urbana')
    expect(html).toContain('/es/mi-tienda/categoria/calzado')
    expect(html).not.toContain('NaN')
  })

  it('sin productos muestra el estado vacío (no rompe)', async () => {
    caller.customer.getProducts.query.mockResolvedValue([])
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./page')
    const html = renderToStaticMarkup(await Page({ params: params() } as never))
    expect(html).toContain('Mi Tienda')
    expect(html).not.toContain('Zapatilla')
  })

  it('tienda inexistente → 404 real (no 500)', async () => {
    caller.customer.resolveStore.query.mockRejectedValue(notFoundError())
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./page')
    await expect404(Page({ params: params({ slug: 'no-existe' }) } as never))
  })

  it('idioma desconocido en la URL → 404', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./page')
    await expect404(Page({ params: params({ locale: 'xx' }) } as never))
  })

  it('si el back falla NO se convierte en 404: se relanza (5xx) para que Google conserve el índice', async () => {
    caller.customer.resolveStore.query.mockRejectedValue(serverError())
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./page')
    const err = await Page({ params: params() } as never).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(TRPCClientError)
  })
})

describe('listado de productos', () => {
  const searchParams = (page?: string) => Promise.resolve(page ? { page } : {})

  it('renderiza el listado con precio formateado y enlaces válidos', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./productos/page')
    const html = renderToStaticMarkup(await Page({ params: params(), searchParams: searchParams() } as never))
    expect(html).toContain('Zapatilla Urbana')
    expect(html).toContain('/es/mi-tienda/productos/zapatilla-urbana')
    expect(html).toMatch(/10\.000/)
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })

  it('una página fuera de rango es 404 real, no un soft-404', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./productos/page')
    await expect404(Page({ params: params(), searchParams: searchParams('99') } as never))
  })

  it('tienda inexistente → 404', async () => {
    caller.customer.resolveStore.query.mockRejectedValue(notFoundError())
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./productos/page')
    await expect404(Page({ params: params(), searchParams: searchParams() } as never))
  })
})

describe('categoría', () => {
  const catParams = (categoria: string) => params({ categoria })

  it('renderiza el título, el breadcrumb y los productos de la categoría', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./categoria/[categoria]/page')
    const html = renderToStaticMarkup(await Page({ params: catParams('calzado') } as never))
    expect(html).toContain('Calzado')
    expect(html).toContain('Zapatilla Urbana')
    expect(html).toContain('/es/mi-tienda/productos/zapatilla-urbana')
    expect(html).toContain('application/ld+json')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it('una categoría inexistente es 404 real', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./categoria/[categoria]/page')
    await expect404(Page({ params: catParams('no-existe') } as never))
  })

  it('idioma desconocido o tienda inexistente: 404', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./categoria/[categoria]/page')
    await expect404(Page({ params: params({ locale: 'xx', categoria: 'calzado' }) } as never))
    caller.customer.resolveStore.query.mockRejectedValue(notFoundError())
    await expect404(Page({ params: catParams('calzado') } as never))
  })
})

describe('detalle de producto', () => {
  it('renderiza nombre, precio, descripción, breadcrumb y datos estructurados', async () => {
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./productos/[handle]/page')
    const html = renderToStaticMarkup(await Page({ params: params({ handle: 'zapatilla-urbana' }) } as never))
    expect(html).toContain('Zapatilla Urbana')
    expect(html).toContain('Cómoda y liviana')
    expect(html).toMatch(/10\.000/)
    expect(html).toContain('application/ld+json')
    expect(html).toContain('Agregar')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })

  it('producto inexistente → 404', async () => {
    caller.customer.getProduct.query.mockRejectedValue(notFoundError())
    const { default: Page } = await load<{ default: (p: never) => Promise<React.ReactElement> }>('./productos/[handle]/page')
    await expect404(Page({ params: params({ handle: 'fantasma' }) } as never))
  })

  it('generateMetadata: canonical, robots y título del producto', async () => {
    const { generateMetadata } = await load<{ generateMetadata: (p: never) => Promise<Record<string, unknown>> }>(
      './productos/[handle]/page',
    )
    vi.stubEnv('SITE_URL', 'https://tiendas.example.com') // sin SITE_URL el canonical/hreflang se desactiva a propósito
    const meta = await generateMetadata({ params: params({ handle: 'zapatilla-urbana' }) } as never)
    expect(meta['title']).toBe('Zapatilla Urbana')
    expect(JSON.stringify(meta['alternates'])).toContain('https://tiendas.example.com')
    expect(meta['robots']).toBeDefined()
    vi.unstubAllEnvs()
  })
})

describe('404 de la tienda', () => {
  it('muestra el mensaje en el idioma de la URL con un enlace de salida', async () => {
    vi.doMock('next/navigation', async (orig) => ({
      ...(await orig<typeof import('next/navigation')>()),
      useParams: () => ({ locale: 'en' }),
    }))
    const { default: NotFound } = await load<{ default: () => React.ReactElement }>('./not-found')
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain('href="/"')
    expect(html).not.toContain('undefined')
    vi.doUnmock('next/navigation')
  })
})
