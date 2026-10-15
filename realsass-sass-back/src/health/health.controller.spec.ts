import { HealthController } from '@/health/health.controller';
import type { PrismaService } from '@/prisma/prisma.service';
import type { RedisService } from '@/redis/redis.service';

describe('HealthController (GET /health: Railway decide con esto)', () => {
  const prisma = { $queryRaw: jest.fn() };
  const redis = { set: jest.fn() };
  const controller = new HealthController(prisma as unknown as PrismaService, redis as unknown as RedisService);

  const slow = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.set.mockResolvedValue(undefined);
  });

  it('db y redis arriba y rápidos => ok', async () => {
    const out = await controller.check();

    expect(out.status).toBe('ok');
    expect(out.db.status).toBe('up');
    expect(out.redis.status).toBe('up');
    expect(out.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof out.version).toBe('string');
  });

  it('sin base de datos => down (sin DB no se sirve nada), aunque Redis esté bien', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const out = await controller.check();

    expect(out.status).toBe('down');
    expect(out.db).toEqual({ status: 'down', latencyMs: 0 });
    expect(out.redis.status).toBe('up');
  });

  it('Redis caído con DB bien => degraded (el servicio sigue sirviendo)', async () => {
    redis.set.mockRejectedValue(new Error('x'));

    const out = await controller.check();

    expect(out.status).toBe('degraded');
    expect(out.redis).toEqual({ status: 'down', latencyMs: 0 });
  });

  it('latencia de la DB por encima de 200 ms => degraded', async () => {
    prisma.$queryRaw.mockImplementation(async () => { await slow(230); return []; });

    const out = await controller.check();

    expect(out.db.latencyMs).toBeGreaterThan(200);
    expect(out.status).toBe('degraded');
  });

  it('DB y Redis caídos => down (la DB manda)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('x'));
    redis.set.mockRejectedValue(new Error('x'));

    expect((await controller.check()).status).toBe('down');
  });

  it('el ping de Redis usa una clave de salud con TTL corto (no deja basura)', async () => {
    await controller.check();

    expect(redis.set).toHaveBeenCalledWith('health:ping', 'pong', 5);
  });
});
