import { z } from 'zod';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import type { MarketDTO } from '@real/trpc/markets';

const MarketDtoSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  countryCode: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  fulfillmentConfig: z.object({
    provider: z.string().optional(),
    contactEmail: z.string().optional(),
    notes: z.string().optional(),
    priority: z.number(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<MarketDTO>;
const MarketEnvelopeSchema = z.object({ result: z.object({ data: MarketDtoSchema }) });

@Injectable()
export class MarketResolverService {
  constructor(private readonly redis: RedisService) {}

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
    const code = visitorCountryCode.toUpperCase() || 'default';
    const cacheKey = `market:${organizationId}:${code}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = MarketDtoSchema.safeParse(JSON.parse(cached));
      if (parsed.success) return parsed.data;
    }

    const url = `${sassBackUrl}/trpc/markets.resolve?input=${encodeURIComponent(
      JSON.stringify({
        organizationId,
        countryCode: code === 'default' ? 'AR' : code,
      }),
    )}`;

    const res = await fetch(url, {
      headers: { 'x-internal-api-key': internalApiKey },
    });
    if (!res.ok) throw new Error(`resolveMarket failed: ${res.status}`);

    const { result } = MarketEnvelopeSchema.parse(await res.json());
    const market = result.data;

    await this.redis.set(cacheKey, JSON.stringify(market), 300);
    return market;
  }
}
