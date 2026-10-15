import { RedisRateLimitStore, type RedisCounter } from '../redis-rate-limit';
import { createRateLimitMiddleware } from '../rate-limit';

/** Redis simulado: un contador atómico con vencimiento, compartido por todas las "réplicas" del test. */
class FakeRedis implements RedisCounter {
  readonly counters = new Map<string, number>();
  readonly ttls = new Map<string, number>();
  incrWithTtl(key: string, ttlMs: number): Promise<number | null> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    if (next === 1) this.ttls.set(key, ttlMs); // el TTL solo se fija en el primer golpe de la ventana
    return Promise.resolve(next);
  }
}

describe('RedisRateLimitStore', () => {
  it('cuenta en Redis y fija el TTL de la ventana en el primer golpe', async () => {
    const redis = new FakeRedis();
    const store = new RedisRateLimitStore(redis);

    expect(await store.hit('k', 60_000)).toBe(1);
    expect(await store.hit('k', 60_000)).toBe(2);
    expect(redis.ttls.get('k')).toBe(60_000);
  });

  it('el contador es COMPARTIDO entre réplicas (con memoria, cada una contaría por su cuenta)', async () => {
    const redis = new FakeRedis();
    const replicaA = new RedisRateLimitStore(redis);
    const replicaB = new RedisRateLimitStore(redis);

    await replicaA.hit('ip:1.1.1.1', 1_000);
    await replicaA.hit('ip:1.1.1.1', 1_000);
    expect(await replicaB.hit('ip:1.1.1.1', 1_000)).toBe(3);
  });

  it('el límite vale para todo el clúster: 10 golpes repartidos entre 2 réplicas cortan al 11.º', async () => {
    const redis = new FakeRedis();
    const mw = (store: RedisRateLimitStore) => createRateLimitMiddleware({
      defaultRule: { limit: 10, windowMs: 1_000, by: 'ip' }, store,
    });
    const a = mw(new RedisRateLimitStore(redis));
    const b = mw(new RedisRateLimitStore(redis));
    const call = async (m: typeof a) => {
      let status = 200;
      const res = { status(c: number) { status = c; return this; }, setHeader() { /* noop */ }, json() { return this; } };
      await m({ path: '/x', ip: '9.9.9.9' } as never, res as never, () => undefined);
      return status;
    };

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push(await call(i % 2 === 0 ? a : b));

    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('Redis deshabilitado (null) => cae a memoria local', async () => {
    const store = new RedisRateLimitStore({ incrWithTtl: () => Promise.resolve(null) });
    expect(await store.hit('k', 1_000)).toBe(1);
    expect(await store.hit('k', 1_000)).toBe(2);
  });

  it('Redis caído (lanza) => cae a memoria local, sin tirar el servicio', async () => {
    const store = new RedisRateLimitStore({ incrWithTtl: () => Promise.reject(new Error('ECONNREFUSED')) });
    expect(await store.hit('k', 1_000)).toBe(1);
    expect(await store.hit('k', 1_000)).toBe(2);
  });
});
