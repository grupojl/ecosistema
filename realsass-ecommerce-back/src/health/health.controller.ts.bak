import { Controller, Get } from '@nestjs/common';
import { Public }          from '@real/auth-server';
import { PrismaService }   from '@/prisma/prisma.service';

interface HealthDetail { status: 'up' | 'down'; latencyMs: number }
interface HealthResponse {
  status:  'ok' | 'degraded';
  db:      HealthDetail;
  uptime:  number;
  version: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const t = Date.now();
    const ok = await this.prisma.$queryRaw`SELECT 1`
      .then(() => true).catch(() => false);
    const db: HealthDetail = { status: ok ? 'up' : 'down', latencyMs: Date.now() - t };

    return {
      status:  ok ? 'ok' : 'degraded',
      db,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
