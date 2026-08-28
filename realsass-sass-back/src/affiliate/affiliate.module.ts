import { Module }                   from '@nestjs/common';
import { AffiliatesController }     from './affiliate.controller';
import { AffiliatesService }        from './affiliate.service';
import { PrismaAffiliateRepository } from './repository/prisma-affiliate.repository';
import { AFFILIATE_REPOSITORY }     from './repository/affiliate.repository.interface';
import { PrismaModule }             from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [AffiliatesController],
  providers:   [
    AffiliatesService,
    { provide: AFFILIATE_REPOSITORY, useClass: PrismaAffiliateRepository },
  ],
  exports:     [AffiliatesService],
})
export class AffiliatesModule {}
