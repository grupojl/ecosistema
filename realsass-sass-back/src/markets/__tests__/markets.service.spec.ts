import { Test } from '@nestjs/testing'
import { MarketsService }       from '@/markets.service'
import { MARKET_REPOSITORY }   from '@/repository/market.repository.interface'
import type { IMarketRepository } from '@/repository/market.repository.interface'
import { Market }               from '@/domain/market.entity'

const mockMarket = (overrides = {}): Market => {
  const props = {
    id:                'market-uuid-1',
    organizationId:    'org-uuid-1',
    countryCode:       'AR',
    isDefault:         true,
    isActive:          true,
    fulfillmentConfig: {},
    createdAt:         new Date(),
    updatedAt:         new Date(),
    ...overrides,
  }
  return Market.fromPrisma(props)
}

describe('MarketsService', () => {
  let service: MarketsService
  let repo:    jest.Mocked<IMarketRepository>

  beforeEach(async () => {
    repo = {
      findAll:    jest.fn(),
      findActive: jest.fn(),
      findDefault: jest.fn(),
      findById:   jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      setDefault: jest.fn(),
      delete:     jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        MarketsService,
        { provide: MARKET_REPOSITORY, useValue: repo },
      ],
    }).compile()

    service = module.get(MarketsService)
  })

  describe('resolveMarket()', () => {
    it('retorna el Market específico del país cuando existe', async () => {
      const market = mockMarket({ countryCode: 'CO', isDefault: false })
      repo.findActive.mockResolvedValue(market)

      const result = await service.resolveMarket('org-uuid-1', 'CO')

      expect(result.countryCode).toBe('CO')
      expect(repo.findActive).toHaveBeenCalledWith('org-uuid-1', 'CO')
      expect(repo.findDefault).not.toHaveBeenCalled()
    })

    it('hace fallback al Market default cuando no existe el específico', async () => {
      const defaultMarket = mockMarket({ countryCode: 'AR', isDefault: true })
      repo.findActive.mockResolvedValue(null)
      repo.findDefault.mockResolvedValue(defaultMarket)

      const result = await service.resolveMarket('org-uuid-1', 'MX')

      expect(result.countryCode).toBe('AR')
      expect(result.isDefault).toBe(true)
    })

    it('lanza TRPCError NOT_FOUND si no hay Market default', async () => {
      repo.findActive.mockResolvedValue(null)
      repo.findDefault.mockResolvedValue(null)

      await expect(service.resolveMarket('org-uuid-1', 'MX'))
        .rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('create()', () => {
    it('lanza CONFLICT si el Market ya existe para ese país', async () => {
      const existing = mockMarket({ countryCode: 'CO' })
      repo.findActive.mockResolvedValue(existing)

      await expect(service.create({ organizationId: 'org-uuid-1', countryCode: 'CO' }))
        .rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })

  describe('update()', () => {
    it('lanza BAD_REQUEST al intentar desactivar el Market default', async () => {
      const defaultMarket = mockMarket({ isDefault: true })
      repo.findById.mockResolvedValue(defaultMarket)

      await expect(service.update('market-uuid-1', { isActive: false }))
        .rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })
  })
})
