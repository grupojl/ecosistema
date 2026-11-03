// @vitest-environment jsdom
/**
 * Hooks de configuración del dashboard contra el cliente tRPC REAL con `fetch` simulado:
 *  - feature flags: el interruptor cambia al instante (optimista) y vuelve atrás si el back falla;
 *  - webhooks: crear/borrar invalida la lista; sin organización no se consulta nada.
 */
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeTrpcClient, trpc } from '@/lib/trpc/client'
import { useFlags, useUpdateFlag } from '@/features/config-flags/hooks/use-flags'
import { useCreateWebhook, useDeleteWebhook, useWebhooks } from '@/features/config-webhooks/hooks/use-webhooks'

const URL = 'http://sass.test/api/v1/trpc'

interface Backend {
  flags: Array<{ id: string; key: string; enabled: boolean }>
  webhooks: Array<{ id: string; url: string }>
  failMutations: boolean
  gate: Promise<void> | null
  listGate: Promise<void> | null
  calls: string[]
}
let backend: Backend

const ok = (data: unknown) => new Response(JSON.stringify([{ result: { data } }]), { status: 200, headers: { 'content-type': 'application/json' } })
const err = () =>
  new Response(JSON.stringify([{ error: { message: 'boom', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } }]), {
    status: 500, headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  backend = {
    flags: [{ id: 'f1', key: 'beta', enabled: false }, { id: 'f2', key: 'chat', enabled: true }],
    webhooks: [{ id: 'w1', url: 'https://a.test/h' }],
    failMutations: false, gate: null, listGate: null, calls: [],
  }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(URL + '/', '').split('?')[0]!
    backend.calls.push(path)
    if (init?.method === 'POST') {
      if (backend.gate) await backend.gate
      if (backend.failMutations) return err()
      const input0 = (JSON.parse(String(init.body))?.['0'] ?? {}) as { flagId?: string; enabled?: boolean; webhookId?: string; url?: string }
      if (path === 'configFlags.update') backend.flags = backend.flags.map((f) => (f.id === input0.flagId ? { ...f, enabled: input0.enabled ?? f.enabled } : f))
      if (path === 'configWebhooks.create') backend.webhooks = [...backend.webhooks, { id: 'w2', url: input0.url ?? '' }]
      if (path === 'configWebhooks.remove') backend.webhooks = backend.webhooks.filter((w) => w.id !== input0.webhookId)
      return ok({ ok: true })
    }
    if (path === 'configFlags.list') {
      if (backend.listGate) await backend.listGate
      return ok(backend.flags)
    }
    if (path === 'configWebhooks.list') return ok(backend.webhooks)
    return err()
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const client = makeTrpcClient(URL, () => 'org-1')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={client} queryClient={queryClient}>{children}</trpc.Provider>
    </QueryClientProvider>
  )
  return { wrapper }
}

describe('useFlags / useUpdateFlag', () => {
  it('no consulta sin organización activa', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useFlags(null), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(backend.calls).toEqual([])
  })

  it('el interruptor cambia ANTES de que responda el back y se confirma al terminar', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useFlags('org-1'), update: useUpdateFlag() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))

    let release!: () => void
    backend.gate = new Promise<void>((r) => { release = r })
    // El refetch final se retiene: así se ve el estado optimista sin que lo pise el servidor.
    let releaseList!: () => void
    backend.listGate = new Promise<void>((r) => { releaseList = r })
    act(() => { result.current.update.mutate({ flagId: 'f1', enabled: true }) })

    await waitFor(() => expect(result.current.list.data?.find((f) => f.id === 'f1')?.enabled).toBe(true))
    expect(backend.flags[0]!.enabled).toBe(false) // el servidor todavía no cambió
    release()
    releaseList()
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true))
    await waitFor(() => expect(result.current.list.data?.find((f) => f.id === 'f1')?.enabled).toBe(true))
    expect(backend.flags[0]!.enabled).toBe(true)
  })

  it('si el back falla, el interruptor vuelve a como estaba (rollback)', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useFlags('org-1'), update: useUpdateFlag() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))

    backend.failMutations = true
    act(() => { result.current.update.mutate({ flagId: 'f1', enabled: true }) })

    await waitFor(() => expect(result.current.update.isError).toBe(true))
    await waitFor(() => expect(result.current.list.data?.find((f) => f.id === 'f1')?.enabled).toBe(false))
  })
})

describe('webhooks', () => {
  it('no consulta sin organización', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useWebhooks(undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('crear un webhook refresca la lista con el nuevo', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useWebhooks('org-1'), create: useCreateWebhook() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(1))

    act(() => { result.current.create.mutate({ url: 'https://b.test/h', events: ['*'] } as never) })

    await waitFor(() => expect(result.current.list.data).toHaveLength(2))
    expect(backend.calls.filter((c) => c === 'configWebhooks.list').length).toBeGreaterThanOrEqual(2) // volvió a pedir la lista
  })

  it('borrar un webhook lo saca de la lista', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useWebhooks('org-1'), remove: useDeleteWebhook() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(1))

    act(() => { result.current.remove.mutate({ webhookId: 'w1' } as never) })

    await waitFor(() => expect(result.current.list.data).toEqual([]))
  })
})
