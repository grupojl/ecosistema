import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard }  from './internal-api-key.guard';
import { MarketsService }       from '../markets/markets.service';

@Controller('internal/organizations')
@UseGuards(InternalApiKeyGuard)
export class MarketsInternalController {
  constructor(private readonly markets: MarketsService) {}

  @Get(':id/markets')
  getMarkets(@Param('id') id: string) {
    return this.markets.list(id);
  }
}
