import { Module }                   from '@nestjs/common';
import { AffiliatesService }        from '@/affiliate/affiliate.service';
import { PrismaAffiliateRepository } from '@/affiliate/repository/prisma-affiliate.repository';
import { AFFILIATE_REPOSITORY }     from '@/affiliate/repository/affiliate.repository.interface';
import { PrismaModule }             from '@/prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  providers:   [
    AffiliatesService,
    { provide: AFFILIATE_REPOSITORY, useClass: PrismaAffiliateRepository },
  ],
  exports:     [AffiliatesService],
})
export class AffiliatesModule {}
