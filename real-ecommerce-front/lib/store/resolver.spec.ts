import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRPCClientError } from '@trpc/client'

// React 19 exporta `cache` solo bajo la condición react-server; en el test es identidad.
vi.mock('react', () => ({ cache: <T extends (...a: never[]) => unknown>(fn: T) => fn }))
const notFound = vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
const resolveStoreQuery = vi.fn()
vi.mock('@/lib/trpc/server', () => ({
  createStoreCaller: () => ({ customer: { resolveStore: { query: resolveStoreQuery } } }),
}))

import { requireStore, resolveStore, trpcErrorCode } from '@/lib/store/resolver'

/** Un error tal como lo recibe el cliente tRPC cuando el back responde con ese código. */
const trpcError = (code: string) =>
  new TRPCClientError(`error ${code}`, { result: { error: { message: code, code: -1, data: { code } } } as never })

describe('ADR-016 — semántica de errores del storefront (SEO)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('NOT_FOUND => null => 404 (Google desindexa: correcto)', async () => {
    resolveStoreQuery.mockRejectedValue(trpcError('NOT_FOUND'))

    expect(await resolveStore('no-existe')).toBeNull()
    await expect(requireStore('no-existe')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it.each(['SERVICE_UNAVAILABLE', 'INTERNAL_SERVER_ERROR', 'TIMEOUT', 'FORBIDDEN', 'UNAUTHORIZED'])(
    '%s se RELANZA => 5xx (Google reintenta y CONSERVA el índice, no se desindexa la tienda)',
    async (code) => {
      resolveStoreQuery.mockRejectedValue(trpcError(code))

      await expect(resolveStore('mi-tienda')).rejects.toBeInstanceOf(TRPCClientError)
      await expect(requireStore('mi-tienda')).rejects.toBeInstanceOf(TRPCClientError)
      expect(notFound).not.toHaveBeenCalled()
    },
  )

  it('una caída de red (no es un error tRPC) también se relanza: nunca se confunde con "no existe"', async () => {
    resolveStoreQuery.mockRejectedValue(new TypeError('fetch failed'))

    await expect(resolveStore('mi-tienda')).rejects.toThrow('fetch failed')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('devuelve la tienda cuando existe', async () => {
    resolveStoreQuery.mockResolvedValue({ organizationId: 'org-1', name: 'Mi tienda' })

    expect(await requireStore('mi-tienda')).toMatchObject({ organizationId: 'org-1' })
    expect(resolveStoreQuery).toHaveBeenCalledWith({ slug: 'mi-tienda' })
  })

  describe('trpcErrorCode', () => {
    it('lee el código solo de errores tRPC bien formados', () => {
      expect(trpcErrorCode(trpcError('NOT_FOUND'))).toBe('NOT_FOUND')
      expect(trpcErrorCode(new Error('x'))).toBeNull()
      expect(trpcErrorCode(null)).toBeNull()
      expect(trpcErrorCode('NOT_FOUND')).toBeNull()
    })
  })
})
