export class MarketNotFoundError extends Error {
  constructor(organizationId: string, countryCode?: string) {
    super(
      countryCode
        ? `Market not found for org=${organizationId} country=${countryCode}`
        : `No default Market found for org=${organizationId}`
    )
    this.name = 'MarketNotFoundError'
  }
}

export class DuplicateMarketError extends Error {
  constructor(organizationId: string, countryCode: string) {
    super(`Market already exists for org=${organizationId} country=${countryCode}`)
    this.name = 'DuplicateMarketError'
  }
}

export class CannotDeactivateDefaultMarketError extends Error {
  constructor(marketId: string) {
    super(`Cannot deactivate the default Market id=${marketId}`)
    this.name = 'CannotDeactivateDefaultMarketError'
  }
}

export class CannotDeleteDefaultMarketError extends Error {
  constructor(marketId: string) {
    super(`Cannot delete the default Market id=${marketId}. Set another as default first.`)
    this.name = 'CannotDeleteDefaultMarketError'
  }
}
