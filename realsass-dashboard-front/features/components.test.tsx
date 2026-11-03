// @vitest-environment jsdom
/**
 * Componentes de presentación del dashboard: badges por estado, tarjetas de balance (4 estados de vista: cargando,
 * error, vacío/datos) y resumen de mercados. Los datos entran por el hook/tRPC simulado; se prueba lo que ve el dueño.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CanalBadge } from '@/features/chat/components/canal-badge'
import { ETAPA_CONFIG, EtapaBadge } from '@/features/chat/components/etapa-badge'
import { TransactionStatusBadge } from '@/features/pagos/components/transaction-status-badge'
import { BalanceCards } from '@/features/pagos/components/balance-card'
import { MarketsSummary } from '@/features/markets/markets-summary'

const balanceState = vi.hoisted(() => ({ value: {} as { data?: unknown; isLoading?: boolean; error?: unknown } }))
vi.mock('@/features/pagos/hooks', () => ({ useBalanceSummary: () => balanceState.value }))

const marketsState = vi.hoisted(() => ({ data: [] as Array<{ id: string; countryCode: string; isActive: boolean }> }))
vi.mock('@/lib/trpc/client', () => ({
  trpc: { markets: { list: { useQuery: () => ({ data: marketsState.data }) } } },
}))

afterEach(cleanup)

describe('badges', () => {
  it.each([
    ['whatsapp', 'WhatsApp'],
    ['instagram', 'Instagram'],
    ['telegram', 'Telegram'],
    ['web', 'Web'],
  ] as const)('CanalBadge %s → %s', (canal, label) => {
    render(<CanalBadge canal={canal} />)
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('EtapaBadge muestra la etiqueta de cada etapa', () => {
    for (const [etapa, cfg] of Object.entries(ETAPA_CONFIG)) {
      const { unmount } = render(<EtapaBadge etapa={etapa as keyof typeof ETAPA_CONFIG} />)
      expect(screen.getByText(cfg.label)).toBeTruthy()
      unmount()
    }
  })

  it.each([
    ['completado', 'Completado'],
    ['pendiente', 'Pendiente'],
    ['fallido', 'Fallido'],
    ['reembolsado', 'Reembolsado'],
  ] as const)('TransactionStatusBadge %s → %s', (estado, label) => {
    render(<TransactionStatusBadge estado={estado} />)
    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('BalanceCards', () => {
  it('cargando: no muestra cifras ni error', () => {
    balanceState.value = { isLoading: true }
    render(<BalanceCards />)
    expect(screen.queryByText(/No se pudo cargar/)).toBeNull()
    expect(screen.queryByText('Total ingresos')).toBeNull()
  })

  it('error o sin datos: avisa que no se pudo cargar', () => {
    balanceState.value = { error: new Error('boom') }
    render(<BalanceCards />)
    expect(screen.getByText(/No se pudo cargar el resumen de balance/)).toBeTruthy()
  })

  it('con datos: muestra las cuatro cifras con su moneda', () => {
    balanceState.value = {
      data: { totalIngresos: 150000, totalPendiente: 20000, totalFallido: 5000, transaccionesHoy: 7, moneda: 'ARS' },
    }
    render(<BalanceCards />)
    for (const label of ['Total ingresos', 'Pendiente', 'Fallido', 'Tx hoy']) expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText(/150\.000/)).toBeTruthy()
  })
})

describe('MarketsSummary', () => {
  it('cuenta solo los mercados activos, con singular/plural y bandera', () => {
    marketsState.data = [
      { id: 'm1', countryCode: 'AR', isActive: true },
      { id: 'm2', countryCode: 'BR', isActive: true },
      { id: 'm3', countryCode: 'MX', isActive: false },
    ]
    render(<MarketsSummary organizationId="org-1" />)
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText(/mercados activos/)).toBeTruthy()
    expect(screen.getByTitle('AR').textContent).toBe('🇦🇷')
    expect(screen.queryByTitle('MX')).toBeNull() // el inactivo no se muestra
  })

  it('un único mercado usa el singular', () => {
    marketsState.data = [{ id: 'm1', countryCode: 'AR', isActive: true }]
    render(<MarketsSummary organizationId="org-1" />)
    expect(screen.getByText('mercado activo')).toBeTruthy()
  })
})
