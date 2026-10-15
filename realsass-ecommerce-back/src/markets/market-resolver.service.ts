import { RedisService } from '@/redis/redis.service'
import { Injectable } from '@nestjs/common'
import type { MarketDTO } from '@real/trpc/markets'

@Injectable()
export class MarketResolverService {
  constructor(
    private readonly redis: RedisService,
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
    if (cached) {
      // Una entrada corrupta equivale a "no está en caché": se vuelve a consultar en lugar de romper el checkout.
      try { return JSON.parse(cached) as MarketDTO } catch { /* cae a la consulta */ }
    }

    const url = `${sassBackUrl}/trpc/markets.resolve?input=${encodeURIComponent(
      JSON.stringify({ organizationId, countryCode: code === 'default' ? 'AR' : code })
    )}`

    const res = await fetch(url, {
      headers: { 'x-internal-api-key': internalApiKey },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`resolveMarket failed: ${res.status}`)

    const { result } = (await res.json()) as { result: { data: MarketDTO } }
    const market      = result.data

    await this.redis.set(cacheKey, JSON.stringify(market), 300)
    return market
  }
}
