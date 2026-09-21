/**
 * Integration test del contrato tRPC de Markets.
 * Usa el router real con un servicio mockeado.
 */
import { createMarketsRouter } from '../../trpc/routers/markets.router'
import { createCallerFactory }  from '@trpc/server'

const mockService = {
  list:          jest.fn(),
  create:        jest.fn(),
  update:        jest.fn(),
  setDefault:    jest.fn(),
  delete:        jest.fn(),
  resolveMarket: jest.fn(),
  seedDefaultMarket: jest.fn(),
}

describe('marketsRouter (tRPC integration)', () => {
  const router      = createMarketsRouter(mockService as any)
  const createCaller = createCallerFactory(router)
  const caller      = createCaller({})

  beforeEach(() => jest.clearAllMocks())

  it('markets.list retorna array', async () => {
    mockService.list.mockResolvedValue([])
    const result = await caller.list({ organizationId: '00000000-0000-0000-0000-000000000001' })
    expect(Array.isArray(result)).toBe(true)
    expect(mockService.list).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001')
  })

  it('markets.create valida countryCode length = 2', async () => {
    await expect(
      caller.create({ organizationId: '00000000-0000-0000-0000-000000000001', countryCode: 'ARG' })
    ).rejects.toThrow()
  })

  it('markets.resolve transforma countryCode a uppercase', async () => {
    mockService.resolveMarket.mockResolvedValue({ countryCode: 'CO' })
    await caller.resolve({ organizationId: '00000000-0000-0000-0000-000000000001', countryCode: 'co' })
    expect(mockService.resolveMarket).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001', 'CO'
    )
  })

  it('markets.setDefault recibe un uuid válido', async () => {
    mockService.setDefault.mockResolvedValue({ isDefault: true })
    await caller.setDefault({ id: '00000000-0000-0000-0000-000000000002' })
    expect(mockService.setDefault).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000002')
  })
})
