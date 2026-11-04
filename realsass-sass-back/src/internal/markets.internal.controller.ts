import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public } from '@real/auth-server';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { MarketsService } from '@/markets/markets.service';

@Public()
// DT-STORE-1: servicio-a-servicio (INTERNAL_API_KEY). No cae en el limitador `auth` (pensado para login) y tiene un tope
// propio holgado: todo el tráfico del storefront sale de pocas IPs y el 30/min global lo cortaría.
@SkipThrottle({ auth: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('internal/organizations')
@UseGuards(InternalApiKeyGuard)
export class MarketsInternalController {
  constructor(private readonly markets: MarketsService) {}

  @Get(':id/markets')
  getMarkets(@Param('id') id: string) {
    return this.markets.list(id);
  }
}
