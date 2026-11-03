import { Module } from '@nestjs/common';
import { IdempotencyService } from '@/idempotency/idempotency.service';

@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
