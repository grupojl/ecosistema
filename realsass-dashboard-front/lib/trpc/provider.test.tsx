// @vitest-environment jsdom
/**
 * DT-DASH-CTX: el dashboard habla con DOS backs (sass-back y ecommerce-back). Con un solo contexto compartido, el
 * provider interno pisaba al externo y todas las consultas `trpc.*` terminaban en el ecommerce-back (404 "No procedure
 * found"). Este test renderiza ambos providers anidados y verifica a QUÉ URL va cada consulta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setActiveOrganizationId } from '@real/auth-client'
import { trpc } from '@/lib/trpc/client'
import { ecommerceTrpc } from '@/lib/trpc/ecommerce-client'
import { TrpcProvider } from '@/lib/trpc/provider'

const SASS = 'http://sass.test'
const ECOM = 'http://ecom.test'

function Probe() {
  // procedures reales de cada back: organizations.me (sass-back) y adminCatalog.list (ecommerce-back)
  trpc.organizations.me.useQuery(undefined, { retry: false })
  ecommerceTrpc.adminCatalog.list.useQuery(undefined, { retry: false })
  return null
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TrpcProvider>
        <Probe />
      </TrpcProvider>
    </QueryClientProvider>,
  )
}

describe('TrpcProvider (sass-back + ecommerce-back)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SASS_BACK_URL = SASS
    process.env.NEXT_PUBLIC_ECOMMERCE_API_URL = `${ECOM}/api/v1` // tolera que la variable ya traiga /api/v1
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      const paths = url.split('/trpc/')[1]!.split('?')[0]!.split(',')
      return new Response(JSON.stringify(paths.map(() => ({ result: { data: null } }))), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    setActiveOrganizationId(null)
    vi.unstubAllGlobals()
    delete process.env.NEXT_PUBLIC_SASS_BACK_URL
    delete process.env.NEXT_PUBLIC_ECOMMERCE_API_URL
  })

  const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))

  it('cada consulta va a SU back: trpc.* a sass-back y ecommerceTrpc.* a ecommerce-back', async () => {
    mount()
    await waitFor(() => expect(urls().length).toBeGreaterThanOrEqual(2))

    const sass = urls().filter((u) => u.startsWith(`${SASS}/api/v1/trpc/`))
    const ecom = urls().filter((u) => u.startsWith(`${ECOM}/api/v1/trpc/`))
    expect(sass.some((u) => u.includes('organizations.me'))).toBe(true)
    expect(ecom.some((u) => u.includes('adminCatalog.list'))).toBe(true)

    // el bug original: una consulta de un back llegando al otro
    expect(sass.some((u) => u.includes('adminCatalog'))).toBe(false)
    expect(ecom.some((u) => u.includes('organizations.me'))).toBe(false)
  })

  it('no duplica /api/v1 aunque la variable de entorno ya lo traiga', async () => {
    mount()
    await waitFor(() => expect(urls().length).toBeGreaterThanOrEqual(2))
    expect(urls().some((u) => u.includes('/api/v1/api/v1'))).toBe(false)
  })

  it('envía la cookie de sesión (credentials: include) y la organización activa a ambos backs', async () => {
    setActiveOrganizationId('org-42')
    mount()
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2))
    for (const [, init] of fetchMock.mock.calls) {
      const i = init as RequestInit
      expect(i.credentials).toBe('include')
      expect((i.headers as Record<string, string>)['x-organization-id']).toBe('org-42')
    }
  })
})
