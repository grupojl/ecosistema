// @vitest-environment jsdom
/**
 * Hooks de la tienda del dashboard (tRPC contra ecommerce-back): actualización OPTIMISTA con rollback.
 * El dueño ve el cambio al instante; si el back falla, la lista vuelve a como estaba (y no queda un dato falso en pantalla).
 * Se prueba contra el cliente tRPC real con `fetch` simulado.
 */
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ecommerceTrpc, makeEcommerceTrpcClient } from '@/lib/trpc/ecommerce-client'
import { useDeleteProduct, useOrders, useProducts, useUpdateProduct } from '@/features/store/hooks'

const URL = 'http://ecom.test/api/v1/trpc'

const product = (id: string, name: string) => ({ id, name, handle: id, status: 'PUBLISHED', variants: [] })
const order = (id: string, status: string) => ({ id, status, totalCents: 100 })

interface Backend {
  products: ReturnType<typeof product>[]
  orders: ReturnType<typeof order>[]
  failMutations: boolean
  gate: Promise<void> | null
  /** Retiene la próxima lectura de la lista: permite ver el estado ANTES de que el refetch final lo corrija. */
  listGate: Promise<void> | null
  mutations: Array<{ path: string; body: unknown }>
}
let backend: Backend

const ok = (data: unknown) => new Response(JSON.stringify([{ result: { data } }]), { status: 200, headers: { 'content-type': 'application/json' } })
const err = () =>
  new Response(JSON.stringify([{ error: { message: 'boom', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } }]), {
    status: 500, headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  backend = { products: [product('p1', 'Zapato'), product('p2', 'Bota')], orders: [order('o1', 'PAID'), order('o2', 'PENDING_PAYMENT')], failMutations: false, gate: null, listGate: null, mutations: [] }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(URL + '/', '').split('?')[0]!
    if (init?.method === 'POST') {
      backend.mutations.push({ path, body: init.body ? JSON.parse(String(init.body)) : null })
      if (backend.gate) await backend.gate
      if (backend.failMutations) return err()
      // aplica el cambio en el "servidor" para que el refetch final coincida
      const input0 = (JSON.parse(String(init.body))?.['0'] ?? {}) as { productId?: string; data?: { name?: string; status?: string } }
      backend.products = backend.products
        .map((p) => (p.id === input0.productId ? { ...p, ...input0.data } : p))
        .filter((p) => p.status !== 'ARCHIVED')
      return ok({ ok: true })
    }
    if (path === 'adminCatalog.list') {
      if (backend.listGate) await backend.listGate
      return ok(backend.products)
    }
    if (path === 'adminOrders.list') return ok(backend.orders)
    return err()
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  const client = makeEcommerceTrpcClient(URL, () => 'org-1')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ecommerceTrpc.Provider client={client} queryClient={queryClient}>{children}</ecommerceTrpc.Provider>
    </QueryClientProvider>
  )
  return { wrapper }
}

const names = (data: ReadonlyArray<{ name: string }> | undefined) => data?.map((p) => p.name)

describe('useProducts / useOrders', () => {
  it('useProducts no consulta sin organización activa', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useProducts(null), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('useOrders filtra por estado en el cliente (el back lista todas)', async () => {
    const { wrapper } = setup()
    const all = renderHook(() => useOrders('org-1'), { wrapper })
    await waitFor(() => expect(all.result.current.data).toHaveLength(2))
    const paid = renderHook(() => useOrders('org-1', { status: 'PAID' as never }), { wrapper })
    await waitFor(() => expect(paid.result.current.data?.map((o) => o.id)).toEqual(['o1']))
  })
})

describe('useUpdateProduct (optimista + rollback)', () => {
  it('muestra el cambio ANTES de que responda el back y lo confirma al terminar', async () => {
    const { wrapper } = setup()
    let release!: () => void
    backend.gate = new Promise<void>((r) => { release = r })
    const { result } = renderHook(() => ({ list: useProducts('org-1'), update: useUpdateProduct() }), { wrapper })
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato', 'Bota']))

    act(() => { result.current.update.mutate({ productId: 'p1', data: { name: 'Zapato Pro' } } as never) })
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato Pro', 'Bota'])) // instantáneo, el back aún no respondió
    expect(result.current.update.isPending).toBe(true)

    release()
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true))
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato Pro', 'Bota']))
  })

  it('si el back falla, la lista VUELVE a como estaba (sin esperar al refetch)', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useProducts('org-1'), update: useUpdateProduct() }), { wrapper })
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato', 'Bota']))
    backend.failMutations = true
    let releaseList!: () => void
    let releaseMutation!: () => void
    backend.listGate = new Promise<void>((r) => { releaseList = r }) // el refetch final queda en espera
    backend.gate = new Promise<void>((r) => { releaseMutation = r }) // el back tarda en fallar

    act(() => { result.current.update.mutate({ productId: 'p1', data: { name: 'Nombre falso' } } as never) })
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Nombre falso', 'Bota'])) // optimista
    releaseMutation() // ahora el back responde con error
    // El refetch final sigue retenido: lo que se ve a continuación es el ROLLBACK, no un dato "curado" por el servidor
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato', 'Bota']))
    expect(result.current.update.isPending).toBe(true) // (react-query espera el refetch de onSettled)
    expect(JSON.stringify(result.current.list.data)).not.toContain('Nombre falso')
    releaseList()
    await waitFor(() => expect(result.current.update.isError).toBe(true))
  })

  it('un campo `undefined` del patch no pisa el valor actual', async () => {
    const { wrapper } = setup()
    let release!: () => void
    backend.gate = new Promise<void>((r) => { release = r })
    const { result } = renderHook(() => ({ list: useProducts('org-1'), update: useUpdateProduct() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))
    act(() => { result.current.update.mutate({ productId: 'p1', data: { name: undefined, status: 'DRAFT' } } as never) })
    await waitFor(() => expect(result.current.list.data?.[0]).toMatchObject({ name: 'Zapato', status: 'DRAFT' }))
    release()
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true))
  })
})

describe('useDeleteProduct (archivar = soft-delete optimista)', () => {
  it('el producto sale de la lista al instante y, si el back falla, vuelve', async () => {
    const { wrapper } = setup()
    let release!: () => void
    backend.gate = new Promise<void>((r) => { release = r })
    backend.failMutations = true
    let releaseList!: () => void
    const { result } = renderHook(() => ({ list: useProducts('org-1'), remove: useDeleteProduct() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))

    act(() => { result.current.remove.mutate({ productId: 'p2', data: { status: 'ARCHIVED' } } as never) })
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato'])) // salió al instante
    backend.listGate = new Promise<void>((r) => { releaseList = r })
    release()
    // El refetch final sigue retenido: volver a ver ambos productos es el ROLLBACK
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato', 'Bota']))
    releaseList()
    await waitFor(() => expect(result.current.remove.isError).toBe(true))
  })

  it('si el back confirma, el producto archivado queda fuera tras refrescar', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ list: useProducts('org-1'), remove: useDeleteProduct() }), { wrapper })
    await waitFor(() => expect(result.current.list.data).toHaveLength(2))
    act(() => { result.current.remove.mutate({ productId: 'p2', data: { status: 'ARCHIVED' } } as never) })
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true))
    await waitFor(() => expect(names(result.current.list.data)).toEqual(['Zapato']))
    expect(backend.mutations.at(-1)?.path).toBe('adminCatalog.update')
  })
})
