import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.fn()
const notFound = vi.fn(() => { throw new Error('NEXT_NOT_FOUND') })

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))
vi.mock('@/lib/trpc/server', () => ({ createStoreCaller: () => ({ customer: { resolveStore: { query } } }) }))

import { TRPCClientError } from '@trpc/client'
import { requireStore, resolveStore, trpcErrorCode } from './resolver'

const trpcError = (code: string) => Object.assign(new TRPCClientError('x'), { data: { code } })

describe('trpcErrorCode', () => {
  it('extrae el código de un TRPCClientError', () => {
    expect(trpcErrorCode(trpcError('NOT_FOUND'))).toBe('NOT_FOUND')
  })
  it('devuelve null para cualquier otra cosa', () => {
    expect(trpcErrorCode(new Error('x'))).toBeNull()
    expect(trpcErrorCode(null)).toBeNull()
    expect(trpcErrorCode(Object.assign(new TRPCClientError('x'), { data: null }))).toBeNull()
    expect(trpcErrorCode(Object.assign(new TRPCClientError('x'), { data: { code: 5 } }))).toBeNull()
  })
})

describe('resolveStore (semántica SEO: 404 solo si no existe; 5xx si falla)', () => {
  beforeEach(() => { query.mockReset(); notFound.mockClear() })

  it('devuelve la tienda', async () => {
    query.mockResolvedValue({ organizationId: 'o1' })
    await expect(resolveStore('mi-tienda')).resolves.toEqual({ organizationId: 'o1' })
    expect(query).toHaveBeenCalledWith({ slug: 'mi-tienda' })
  })

  it('NOT_FOUND → null (la página responde 404)', async () => {
    query.mockRejectedValue(trpcError('NOT_FOUND'))
    await expect(resolveStore('x')).resolves.toBeNull()
  })

  it('cualquier otro error se relanza (Google reintenta y conserva el índice)', async () => {
    query.mockRejectedValue(trpcError('INTERNAL_SERVER_ERROR'))
    await expect(resolveStore('x')).rejects.toThrow()
    query.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(resolveStore('x')).rejects.toThrow('ECONNREFUSED')
  })
})

describe('requireStore', () => {
  beforeEach(() => { query.mockReset(); notFound.mockClear() })

  it('devuelve la tienda si existe', async () => {
    query.mockResolvedValue({ organizationId: 'o1' })
    await expect(requireStore('a')).resolves.toEqual({ organizationId: 'o1' })
    expect(notFound).not.toHaveBeenCalled()
  })

  it('si no existe dispara notFound()', async () => {
    query.mockRejectedValue(trpcError('NOT_FOUND'))
    await expect(requireStore('a')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledTimes(1)
  })
})
