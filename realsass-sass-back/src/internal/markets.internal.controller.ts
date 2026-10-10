import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public }              from '@real/auth-server';
import { InternalApiKeyGuard }  from '@/internal/internal-api-key.guard';
import { MarketsService }       from '@/markets/markets.service';

@Public()
@Controller('internal/organizations')
@UseGuards(InternalApiKeyGuard)
export class MarketsInternalController {
  constructor(private readonly markets: MarketsService) {}

  @Get(':id/markets')
  getMarkets(@Param('id') id: string) {
    return this.markets.list(id);
  }
}
