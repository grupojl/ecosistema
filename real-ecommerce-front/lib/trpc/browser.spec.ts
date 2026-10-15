import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserCaller } from '@/lib/trpc/browser'

/**
 * La sesión del cliente es una cookie HttpOnly: el JavaScript nunca la ve. Para que el navegador la mande
 * (y guarde la que llega en customer.identify) TODA llamada tiene que ir con credentials: 'include'.
 */
describe('createBrowserCaller (sesión por cookie HttpOnly)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ result: { data: { customerId: 'c-1', isNew: true } } }]), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_ECOMMERCE_API_URL', 'https://api.tienda.test')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); fetchMock.mockReset() })

  it('envía credentials: "include" para que viaje (y se guarde) la cookie de sesión', async () => {
    await createBrowserCaller('org-1').customer.identify.mutate({ organizationId: '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe('include')
  })

  it('apunta a /api/v1/trpc de la API y manda la organización', async () => {
    await createBrowserCaller('org-1').customer.identify.mutate({ organizationId: '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/^https:\/\/api\.tienda\.test\/api\/v1\/trpc\/customer\.identify/)
    expect(new Headers(init.headers).get('x-organization-id')).toBe('org-1')
  })

  it('NO manda ningún header con la identidad del cliente (ni x-customer-id ni x-customer-token)', async () => {
    await createBrowserCaller('org-1').customer.logout.mutate()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.has('x-customer-id')).toBe(false)
    expect(headers.has('x-customer-token')).toBe(false)
    expect(headers.has('authorization')).toBe(false)
  })
})
