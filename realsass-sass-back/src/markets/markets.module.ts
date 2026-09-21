import { Module }                   from '@nestjs/common'
import { PrismaModule }             from '../prisma/prisma.module'
import { MarketsService }           from './markets.service'
import { PrismaMarketRepository }   from './repository/prisma-market.repository'
import { MARKET_REPOSITORY }        from './repository/market.repository.interface'

@Module({
  imports:   [PrismaModule],
  providers: [
    MarketsService,
    { provide: MARKET_REPOSITORY, useClass: PrismaMarketRepository },
  ],
  exports:   [MarketsService],
})
export class MarketsModule {}
