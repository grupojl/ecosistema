import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliate.controller';
import { AffiliatesService } from './affiliate.service';

@Module({
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}