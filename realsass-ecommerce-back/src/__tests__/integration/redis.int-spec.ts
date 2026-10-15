/**
 * redis.int-spec.ts — ecommerce-back contra un Redis REAL (efímero).
 *
 * Cubre el contador atómico del rate limit de /trpc (ADR-023) y el caché del resolver de mercados.
 * Se saltea con aviso si no hay TEST_REDIS_URL (en el CI es obligatoria: ver test/integration-env.js).
 */
import { RedisService } from '@/redis/redis.service';
import { MarketResolverService } from '@/markets/market-resolver.service';

const enabled = Boolean(process.env['TEST_REDIS_URL']);
if (!enabled) console.warn('[redis.int-spec] TEST_REDIS_URL no definida: se saltean los tests de Redis.');
const suite = enabled ? describe : describe.skip;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

suite('Redis real (ecommerce-back)', () => {
  const a = new RedisService();
  const b = new RedisService();
  const PREFIX = `it:${process.pid}:`;
  const key = (n: string) => `${PREFIX}${n}`;
  const created: string[] = [];

  beforeAll(() => {
    a.onModuleInit();
    b.onModuleInit();
  });

  afterEach(async () => {
    for (const k of created.splice(0)) await a.del(k);
  });

  afterAll(async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  const track = (k: string) => { created.push(k); return k; };

  it('set/get con TTL: el valor vence', async () => {
    await a.set(track(key('v')), 'x', 1);
    expect(await a.get(key('v'))).toBe('x');

    await sleep(1300);

    expect(await a.get(key('v'))).toBeNull();
  });

  it('del borra la clave', async () => {
    await a.set(track(key('d')), 'x', 30);

    await a.del(key('d'));

    expect(await a.get(key('d'))).toBeNull();
  });

  describe('incrWithTtl: base del rate limit de /trpc', () => {
    it('cuenta de a uno y la ventana vence', async () => {
      track(key('w'));
      expect(await a.incrWithTtl(key('w'), 300)).toBe(1);
      expect(await a.incrWithTtl(key('w'), 300)).toBe(2);

      await sleep(450);

      expect(await a.incrWithTtl(key('w'), 300)).toBe(1);
    });

    it('40 incrementos concurrentes dan exactamente 1..40 (sin carreras)', async () => {
      track(key('par'));

      const results = await Promise.all(Array.from({ length: 40 }, () => a.incrWithTtl(key('par'), 10_000)));

      expect([...results].sort((x, y) => Number(x) - Number(y))).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    });

    it('dos réplicas del servicio comparten el contador: el límite es global', async () => {
      track(key('shared'));

      const results = await Promise.all([
        a.incrWithTtl(key('shared'), 10_000), b.incrWithTtl(key('shared'), 10_000),
        a.incrWithTtl(key('shared'), 10_000), b.incrWithTtl(key('shared'), 10_000),
      ]);

      expect([...results].sort()).toEqual([1, 2, 3, 4]);
    });
  });

  describe('MarketResolverService con caché real', () => {
    const resolver = new MarketResolverService(a);
    const MARKET = { id: 'm1', countryCode: 'BR', isDefault: false };
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: { data: MARKET } }) } as Response);
    });
    afterEach(() => fetchSpy.mockRestore());

    it('la segunda consulta sale del caché (sass-back se llama UNA vez) y queda con TTL', async () => {
      track('market:it-org:BR');

      await resolver.resolveMarket('it-org', 'br', 'http://sass', 'k');
      await resolver.resolveMarket('it-org', 'br', 'http://sass', 'k');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('una entrada corrupta en Redis se ignora y se vuelve a consultar', async () => {
      await a.set(track('market:it-org2:BR'), '{corrupto', 60);

      await expect(resolver.resolveMarket('it-org2', 'BR', 'http://sass', 'k')).resolves.toEqual(MARKET);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
