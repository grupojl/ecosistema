// realsass-sass-back/src/health/health-extended.controller.ts
// ADR-010 — /api/v1/health/extended para superadmin.
// El /api/v1/health original (Railway healthcheck) NO se toca.
// sass-back no tiene circuit breakers — solo DB y Redis.
import { Controller, Get } from '@nestjs/common';
import { Public }          from '@real/auth-server';
import { PrismaService }   from '../prisma/prisma.service';
import { RedisService }    from '../redis/redis.service';

@Controller('api/v1/health')
export class HealthExtendedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  /**
   * GET /api/v1/health/extended
   * Retorna estado extendido que el superadmin consume para el Command Center.
   * Shape idéntico al de ecosistema-ms para que WelverClient lo maneje igual.
   */
  @Get('extended')
  @Public()
  async extended(): Promise<{
    status:          'ok' | 'degraded' | 'down';
    db:              boolean;
    redis:           boolean;
    circuitBreakers: Array<{ key: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }>;
    dlqDepth:        Record<string, number>;
  }> {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {}

    const redisOk = this.redis.isConnected;

    // sass-back no tiene circuit breakers propios
    // El webhook-delivery.processor usa reintentos BullMQ nativos, no opossum
    return {
      status:          (!dbOk ? 'down' : !redisOk ? 'degraded' : 'ok'),
      db:              dbOk,
      redis:           redisOk,
      circuitBreakers: [],
      dlqDepth:        {},
    };
  }
}
