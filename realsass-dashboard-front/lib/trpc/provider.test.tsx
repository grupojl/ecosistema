// @vitest-environment jsdom
/**
 * El dashboard habla con UN back (sass-back, que también es el back de Welver). Este test renderiza el provider y
 * verifica a QUÉ URL va cada consulta, que no se duplica /api/v1 y que viajan la sesión y la organización activa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setActiveOrganizationId } from '@real/auth-client'
import { trpc } from '@/lib/trpc/client'
import { TrpcProvider } from '@/lib/trpc/provider'

const SASS = 'http://sass.test'

function Probe() {
  // procedures reales: organizations.me (identidad) y organigrama.list (Welver)
  trpc.organizations.me.useQuery(undefined, { retry: false })
  trpc.organigrama.list.useQuery(undefined, { retry: false })
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

describe('TrpcProvider (sass-back)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SASS_BACK_URL = `${SASS}/api/v1` // tolera que la variable ya traiga /api/v1
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
  })

  const urls = () => fetchMock.mock.calls.map((c) => String(c[0]))

  it('las consultas de identidad y de Welver van a sass-back', async () => {
    mount()
    await waitFor(() => expect(urls().length).toBeGreaterThanOrEqual(1))
    const sass = urls().filter((u) => u.startsWith(`${SASS}/api/v1/trpc/`))
    expect(sass.some((u) => u.includes('organizations.me'))).toBe(true)
    expect(sass.some((u) => u.includes('organigrama.list'))).toBe(true)
  })

  it('no duplica /api/v1 aunque la variable de entorno ya lo traiga', async () => {
    mount()
    await waitFor(() => expect(urls().length).toBeGreaterThanOrEqual(1))
    expect(urls().some((u) => u.includes('/api/v1/api/v1'))).toBe(false)
  })

  it('envía la cookie de sesión (credentials: include) y la organización activa', async () => {
    setActiveOrganizationId('org-42')
    mount()
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1))
    for (const [, init] of fetchMock.mock.calls) {
      const i = init as RequestInit
      expect(i.credentials).toBe('include')
      expect((i.headers as Record<string, string>)['x-organization-id']).toBe('org-42')
    }
  })
})
