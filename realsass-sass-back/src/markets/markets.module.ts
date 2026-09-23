import { Module }                   from '@nestjs/common'
import { PrismaModule }             from '@/prisma/prisma.module'
import { MarketsService }           from '@/markets/markets.service'
import { PrismaMarketRepository }   from '@/markets/repository/prisma-market.repository'
import { MARKET_REPOSITORY }        from '@/markets/repository/market.repository.interface'

@Module({
  imports:   [PrismaModule],
  providers: [
    MarketsService,
    { provide: MARKET_REPOSITORY, useClass: PrismaMarketRepository },
  ],
  exports:   [MarketsService],
})
export class MarketsModule {}
