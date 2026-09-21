import { Injectable } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import type Redis from 'ioredis'
import type { MarketDTO } from '@real/trpc'

@Injectable()
export class MarketResolverService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Llama al endpoint interno de sass-back para resolver el Market.
   * Cachea 5 minutos — Markets no cambian en caliente durante operación normal.
   */
  async resolveMarket(
    organizationId: string,
    visitorCountryCode: string,
    sassBackUrl: string,
    internalApiKey: string,
  ): Promise<MarketDTO> {
    const code     = visitorCountryCode.toUpperCase() || 'default'
    const cacheKey = `market:${organizationId}:${code}`

    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached) as MarketDTO

    const url = `${sassBackUrl}/trpc/markets.resolve?input=${encodeURIComponent(
      JSON.stringify({ organizationId, countryCode: code === 'default' ? 'AR' : code })
    )}`

    const res = await fetch(url, {
      headers: { 'x-internal-api-key': internalApiKey },
    })
    if (!res.ok) throw new Error(`resolveMarket failed: ${res.status}`)

    const { result } = (await res.json()) as { result: { data: MarketDTO } }
    const market      = result.data

    await this.redis.setex(cacheKey, 300, JSON.stringify(market))
    return market
  }
}
