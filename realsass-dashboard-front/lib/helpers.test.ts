/**
 * Helpers de formato del dashboard y query keys de prefetch. Las keys NO pueden desviarse de las que genera
 * @trpc/react-query: si lo hacen, el HydrationBoundary no hidrata y cada pantalla vuelve a pedir lo que el servidor ya trajo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDate, formatMoney, formatRelativeTime, getInitials } from '@/lib/helpers'
import { getQueryKey } from '@trpc/react-query'
import { ecommerceQueryKeys } from '@/lib/trpc/keys'
import { ecommerceTrpc } from '@/lib/trpc/ecommerce-client'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it.each([
    [10_000, 'ahora'],
    [5 * 60_000, '5m'],
    [59 * 60_000, '59m'],
    [3 * 3_600_000, '3h'],
    [23 * 3_600_000, '23h'],
  ])('hace %i ms → %s', (ms, expected) => {
    expect(formatRelativeTime(ago(ms))).toBe(expected)
  })

  it('pasadas 24 h muestra la fecha corta dd/mm', () => {
    expect(formatRelativeTime(ago(3 * 86_400_000))).toMatch(/^\d{2}\/\d{2}$/)
  })
})

describe('formatMoney / formatDate / getInitials', () => {
  it('formatea en pesos sin decimales y respeta la moneda pedida', () => {
    expect(formatMoney(1234)).toMatch(/1\.234/)
    expect(formatMoney(1234)).not.toMatch(/,/)
    expect(formatMoney(50, 'USD')).toMatch(/50/)
    expect(formatMoney(50, 'USD')).not.toBe(formatMoney(50, 'ARS'))
  })

  it('formatDate incluye día, mes, año corto y hora', () => {
    expect(formatDate('2026-11-03T15:30:00Z')).toMatch(/\d{2}\/\d{2}\/\d{2}/)
  })

  it('getInitials toma hasta 2 iniciales en mayúscula', () => {
    expect(getInitials('ana maría pérez')).toBe('AM')
    expect(getInitials('juan')).toBe('J')
  })
})

describe('ecommerceQueryKeys', () => {
  it('coinciden con las keys reales de @trpc/react-query (si no, la hidratación falla en silencio)', () => {
    expect(ecommerceQueryKeys.products).toEqual(getQueryKey(ecommerceTrpc.adminCatalog.list, undefined, 'query'))
    expect(ecommerceQueryKeys.orders).toEqual(getQueryKey(ecommerceTrpc.adminOrders.list, undefined, 'query'))
  })
})
