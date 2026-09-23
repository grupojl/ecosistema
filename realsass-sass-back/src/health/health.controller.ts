import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public }        from '@real/auth-server';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService }  from '@/redis/redis.service';

interface HealthDetail { status: 'up' | 'down'; latencyMs: number }
interface HealthResponse {
  status:  'ok' | 'degraded';
  db:      HealthDetail;
  redis:   HealthDetail;
  uptime:  number;
  version: string;
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
        await this.redis.set('health:ping', 'pong', 5).catch(() => { throw new Error('redis') });
        return { status: 'up' as const, latencyMs: Date.now() - t };
      })(),
    ]);

    const db    = dbR.status    === 'fulfilled' ? dbR.value    : { status: 'down' as const, latencyMs: 0 };
    const redis = redisR.status === 'fulfilled' ? redisR.value : { status: 'down' as const, latencyMs: 0 };

    return {
      status:  db.status === 'down' || redis.status === 'down' ? 'degraded' : 'ok',
      db,
      redis,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
