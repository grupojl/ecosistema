import { Injectable, Inject } from '@nestjs/common'
import { TRPCError }          from '@trpc/server'
import type { IMarketRepository } from '@/markets/repository/market.repository.interface'
import { MARKET_REPOSITORY }      from '@/markets/repository/market.repository.interface'
import { FulfillmentConfigSchema } from '@/markets/domain/market.entity'
import type { FulfillmentConfig }  from '@/markets/domain/market.entity'
import {
  MarketNotFoundError,
  DuplicateMarketError,
  CannotDeactivateDefaultMarketError,
  CannotDeleteDefaultMarketError,
} from '@/markets/domain/market.errors'
import type { MarketDTO } from '@/markets/domain/market.entity'

@Injectable()
export class MarketsService {
  constructor(
    @Inject(MARKET_REPOSITORY) private readonly repo: IMarketRepository,
  ) {}

  // ── resolveMarket — contrato central: NUNCA retorna null ───────────────────
  async resolveMarket(organizationId: string, visitorCountryCode: string): Promise<MarketDTO> {
    const specific = await this.repo.findActive(organizationId, visitorCountryCode)
    if (specific) return specific.toDTO()

    const fallback = await this.repo.findDefault(organizationId)
    if (!fallback) {
      throw new TRPCError({
        code:    'NOT_FOUND',
        message: new MarketNotFoundError(organizationId).message,
      })
    }
    return fallback.toDTO()
  }

  async list(organizationId: string): Promise<MarketDTO[]> {
    const markets = await this.repo.findAll(organizationId)
    return markets.map(m => m.toDTO())
  }

  async create(input: {
    organizationId:    string
    countryCode:       string
    fulfillmentConfig?: FulfillmentConfig
  }): Promise<MarketDTO> {
    // Invariante: no duplicados por (organizationId, countryCode)
    const existing = await this.repo.findActive(input.organizationId, input.countryCode)
    if (existing) {
      throw new TRPCError({
        code:    'CONFLICT',
        message: new DuplicateMarketError(input.organizationId, input.countryCode).message,
      })
    }
    const isFirstMarket = (await this.repo.findAll(input.organizationId)).length === 0
    const market = await this.repo.create({
      organizationId:    input.organizationId,
      countryCode:       input.countryCode,
      isDefault:         isFirstMarket,
      fulfillmentConfig: FulfillmentConfigSchema.parse(input.fulfillmentConfig ?? {}),
    })
    return market.toDTO()
  }

  async update(id: string, data: { isActive?: boolean; fulfillmentConfig?: FulfillmentConfig }): Promise<MarketDTO> {
    const market = await this.repo.findById(id)
    if (!market) throw new TRPCError({ code: 'NOT_FOUND', message: `Market id=${id} not found` })

    // Invariante: el Market default no puede desactivarse
    if (market.isDefault && data.isActive === false) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: new CannotDeactivateDefaultMarketError(id).message,
      })
    }
    const updated = await this.repo.update(id, data)
    return updated.toDTO()
  }

  async setDefault(id: string): Promise<MarketDTO> {
    const market = await this.repo.findById(id)
    if (!market) throw new TRPCError({ code: 'NOT_FOUND', message: `Market id=${id} not found` })
    const updated = await this.repo.setDefault(id, market.organizationId)
    return updated.toDTO()
  }

  async delete(id: string): Promise<void> {
    const market = await this.repo.findById(id)
    if (!market) throw new TRPCError({ code: 'NOT_FOUND', message: `Market id=${id} not found` })
    if (market.isDefault) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: new CannotDeleteDefaultMarketError(id).message,
      })
    }
    await this.repo.delete(id)
  }

  // Llamado internamente al crear una Organization (seed del Market default)
  async seedDefaultMarket(organizationId: string, countryCode: string): Promise<MarketDTO> {
    const market = await this.repo.create({
      organizationId,
      countryCode:       countryCode.toUpperCase(),
      isDefault:         true,
      fulfillmentConfig: {},
    })
    return market.toDTO()
  }
}
