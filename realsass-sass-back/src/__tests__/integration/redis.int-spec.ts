/**
 * redis.int-spec.ts — sass-back contra un Redis REAL (efímero).
 *
 * Lo que los dobles no prueban: que el script Lua es atómico bajo concurrencia, que el TTL realmente vence,
 * que dos réplicas comparten contadores (rate limit) y que la invalidación de caché por patrón es por organización.
 * Se saltea con aviso si no hay TEST_REDIS_URL (en el CI es obligatoria: ver test/integration-env.js).
 */
import Redis from 'ioredis';
import { RedisService } from '@/redis/redis.service';
import { ConfigCacheService } from '@/config-cache/config-cache.service';
import { HealthController } from '@/health/health.controller';
import type { PrismaService } from '@/prisma/prisma.service';

const enabled = Boolean(process.env['TEST_REDIS_URL']);
if (!enabled) console.warn('[redis.int-spec] TEST_REDIS_URL no definida: se saltean los tests de Redis.');
const suite = enabled ? describe : describe.skip;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

suite('Redis real (sass-back)', () => {
  const a = new RedisService();
  const b = new RedisService();   // "segunda réplica"
  const PREFIX = `it:${process.pid}:`;
  const key = (n: string) => `${PREFIX}${n}`;

  beforeAll(async () => {
    await a.onModuleInit();
    await b.onModuleInit();
    expect(a.isConnected).toBe(true);
  });

  afterEach(async () => {
    const leftovers = await a.keys(`${PREFIX}*`);
    await a.del(...leftovers);
    const cfg = await a.keys('config:it-*');
    await a.del(...cfg);
  });

  afterAll(async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  describe('set / get / TTL', () => {
    it('guarda y devuelve; un valor con TTL de 1 s VENCE', async () => {
      await a.set(key('v'), 'hola', 1);
      expect(await a.get(key('v'))).toBe('hola');

      await sleep(1300);

      expect(await a.get(key('v'))).toBeNull();
    });

    it('setJson / getJson hacen ida y vuelta; un valor no-JSON en Redis da null (no rompe)', async () => {
      await a.setJson(key('j'), { n: 1, ok: true }, 30);
      expect(await a.getJson(key('j'))).toEqual({ n: 1, ok: true });

      await a.set(key('roto'), '{no es json', 30);
      expect(await a.getJson(key('roto'))).toBeNull();
    });
  });

  describe('incrWithTtl: contador atómico del rate limit', () => {
    it('cuenta 1, 2, 3… y SOLO el primer INCR fija el vencimiento', async () => {
      expect(await a.incrWithTtl(key('c'), 5_000)).toBe(1);
      const ttlAfterFirst = await rawPttl(key('c'));
      await sleep(150);
      expect(await a.incrWithTtl(key('c'), 5_000)).toBe(2);
      const ttlAfterSecond = await rawPttl(key('c'));

      expect(ttlAfterFirst).toBeGreaterThan(0);
      expect(ttlAfterFirst).toBeLessThanOrEqual(5_000);
      expect(ttlAfterSecond).toBeLessThan(ttlAfterFirst);   // no se renovó: la ventana es fija
    });

    it('la ventana vence y el contador arranca de nuevo en 1', async () => {
      await a.incrWithTtl(key('w'), 300);
      await a.incrWithTtl(key('w'), 300);
      await sleep(450);

      expect(await a.incrWithTtl(key('w'), 300)).toBe(1);
    });

    it('50 incrementos concurrentes dan EXACTAMENTE 1..50 sin repetidos ni saltos, y la clave queda con TTL', async () => {
      const results = await Promise.all(Array.from({ length: 50 }, () => a.incrWithTtl(key('par'), 10_000)));

      expect([...results].sort((x, y) => Number(x) - Number(y))).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
      expect(await rawPttl(key('par'))).toBeGreaterThan(0);   // nunca queda una clave sin TTL (bloqueo permanente)
    });

    it('dos réplicas comparten el contador (el límite es global, no por proceso)', async () => {
      const results = await Promise.all([
        a.incrWithTtl(key('shared'), 10_000), b.incrWithTtl(key('shared'), 10_000),
        a.incrWithTtl(key('shared'), 10_000), b.incrWithTtl(key('shared'), 10_000),
      ]);

      expect([...results].sort()).toEqual([1, 2, 3, 4]);
    });
  });

  describe('ConfigCacheService sobre Redis real', () => {
    const cache = new ConfigCacheService(a);

    it('del(org, tipo) invalida SOLO esa organización y ese tipo', async () => {
      await cache.set('it-a', 'flags', '1', { v: 1 }, 60);
      await cache.set('it-a', 'flags', '2', { v: 2 }, 60);
      await cache.set('it-a', 'theme', '1', { v: 3 }, 60);
      await cache.set('it-b', 'flags', '1', { v: 4 }, 60);

      await cache.del('it-a', 'flags');

      expect(await cache.get('it-a', 'flags', '1')).toBeNull();
      expect(await cache.get('it-a', 'flags', '2')).toBeNull();
      expect(await cache.get('it-a', 'theme', '1')).toEqual({ v: 3 });
      expect(await cache.get('it-b', 'flags', '1')).toEqual({ v: 4 });
    });

    it('una entrada corrupta se lee como "no está en caché"', async () => {
      await a.set('config:it-a:flags:roto', '{corrupto', 60);

      expect(await cache.get('it-a', 'flags', 'roto')).toBeNull();
    });
  });

  describe('GET /health con Redis real', () => {
    it('Redis arriba y la base respondiendo => ok, y el ping deja una clave con TTL corto', async () => {
      const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) };
      const controller = new HealthController(prisma as unknown as PrismaService, a);

      const out = await controller.check();

      expect(out.redis.status).toBe('up');
      expect(out.status).toBe('ok');
      expect(await rawPttl('health:ping')).toBeGreaterThan(0);
    });
  });

  /** TTL en ms de una clave, consultado por un camino independiente del servicio bajo prueba. */
  async function rawPttl(k: string): Promise<number> {
    const probe = new Redis(process.env['TEST_REDIS_URL'] as string);
    try { return await probe.pttl(k); } finally { probe.disconnect(); }
  }
});
