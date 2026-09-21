import type { Market, FulfillmentConfig } from '../domain/market.entity'

export const MARKET_REPOSITORY = Symbol('MARKET_REPOSITORY')

export interface IMarketRepository {
  findAll(organizationId: string): Promise<Market[]>
  findActive(organizationId: string, countryCode: string): Promise<Market | null>
  findDefault(organizationId: string): Promise<Market | null>
  findById(id: string): Promise<Market | null>
  create(data: {
    organizationId:    string
    countryCode:       string
    isDefault:         boolean
    fulfillmentConfig: FulfillmentConfig
  }): Promise<Market>
  update(id: string, data: {
    isActive?:          boolean
    fulfillmentConfig?: FulfillmentConfig
  }): Promise<Market>
  setDefault(id: string, organizationId: string): Promise<Market>
  delete(id: string): Promise<void>
}
