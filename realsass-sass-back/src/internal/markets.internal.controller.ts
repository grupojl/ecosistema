import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public }              from '@real/auth-server';
import { InternalApiKeyGuard }  from '@/internal/internal-api-key.guard';
import { MarketsService }       from '@/markets/markets.service';
import { isUuid, runInTenant }  from '@/prisma/tenant-context';

@Public()
@Controller('internal/organizations')
@UseGuards(InternalApiKeyGuard)
export class MarketsInternalController {
  constructor(private readonly markets: MarketsService) {}

  @Get(':id/markets')
  getMarkets(@Param('id') id: string) {
    if (!isUuid(id)) throw new BadRequestException('id de organización inválido');
    // ADR-027: llamada de servicio (superadmin): la organización viene por la URL y el alcance se abre acá.
    return runInTenant(id, () => this.markets.list(id));
  }
}
