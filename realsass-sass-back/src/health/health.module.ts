// realsass-sass-back/src/health/health.module.ts
import { Module }                   from '@nestjs/common';
import { TerminusModule }           from '@nestjs/terminus';
import { HealthController }         from './health.controller';
import { HealthExtendedController } from './health-extended.controller';
// PrismaModule y RedisModule son @Global() en sass-back
// PrismaService y RedisService disponibles sin importar aquí

@Module({
  imports:     [TerminusModule],
  controllers: [HealthController, HealthExtendedController],
})
export class HealthModule {}
