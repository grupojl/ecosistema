/**
 * health.controller.ts — realsass-sass-back
 *
 * GET /health — 3 estados:
 *   ok:       db + redis UP con latencia normal
 *   degraded: db o redis UP pero latencia > LATENCY_WARN_MS (200ms)
 *             o una dependencia UP + otra DOWN (servicio parcialmente funcional)
 *   down:     db DOWN (sin DB no podemos servir ningún request)
 *
 * Railway usa este endpoint para healthcheck — respuesta en < 200ms obligatoria.
 * E12-02 — Fase 4 / Escalón 12
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public }        from '@real/auth-server';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService }  from '@/redis/redis.service';

const LATENCY_WARN_MS = 200;

type HealthStatus = 'ok' | 'degraded' | 'down';

interface HealthDetail {
  status:    'up' | 'down';
  latencyMs: number;
}

interface HealthResponse {
  status:  HealthStatus;
  db:      HealthDetail;
  redis:   HealthDetail;
  uptime:  number;
  version: string;
}

function resolveStatus(db: HealthDetail, redis: HealthDetail): HealthStatus {
  // down: DB caída → no podemos servir ningún request
  if (db.status === 'down') return 'down';

  // degraded: Redis caído (fallback a MemoryCache pero con limitaciones) o latencia alta
  if (redis.status === 'down') return 'degraded';
  if (db.latencyMs > LATENCY_WARN_MS || redis.latencyMs > LATENCY_WARN_MS) return 'degraded';

  return 'ok';
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthResponse> {
    const [dbR, redisR] = await Promise.allSettled([
      (async () => {
        const t = Date.now();
        await this.prisma.$queryRaw`SELECT 1`;
        return { status: 'up' as const, latencyMs: Date.now() - t };
      })(),
      (async () => {
        const t = Date.now();
        await this.redis.set('health:ping', 'pong', 5)
          .catch(() => { throw new Error('redis unreachable'); });
        return { status: 'up' as const, latencyMs: Date.now() - t };
      })(),
    ]);

    const db    = dbR.status    === 'fulfilled' ? dbR.value    : { status: 'down' as const, latencyMs: 0 };
    const redis = redisR.status === 'fulfilled' ? redisR.value : { status: 'down' as const, latencyMs: 0 };

    return {
      status:  resolveStatus(db, redis),
      db,
      redis,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
