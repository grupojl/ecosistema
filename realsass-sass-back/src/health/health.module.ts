// src/health/health.module.ts
import { Module }  from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule }  from '../redis/redis.module';
// shadowed: from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
