jest.mock('@real/auth-server', () => ({ Public: () => () => undefined }));
import { HealthController } from './health.controller';

const make = (db: () => Promise<unknown>, redis: () => Promise<unknown>) => {
  const prisma = { $queryRaw: jest.fn(db) };
  const redisSvc = { set: jest.fn(redis) };
  return new HealthController(prisma as never, redisSvc as never);
};
const ok = () => Promise.resolve([{ '?column?': 1 }]);
const slow = (ms: number) => () => new Promise((r) => setTimeout(() => r(undefined), ms));
const fail = () => Promise.reject(new Error('caído'));

describe('HealthController (healthcheck de Railway)', () => {
  it('ok: base y Redis responden rápido', async () => {
    const r = await make(ok, ok).check();
    expect(r.status).toBe('ok');
    expect(r.db.status).toBe('up');
    expect(r.redis.status).toBe('up');
    expect(typeof r.uptime).toBe('number');
  });

  it('down: sin base de datos no se puede servir ningún request', async () => {
    const r = await make(fail, ok).check();
    expect(r.status).toBe('down');
    expect(r.db.status).toBe('down');
  });

  it('degraded: Redis caído (el servicio sigue, con limitaciones)', async () => {
    const r = await make(ok, fail).check();
    expect(r.status).toBe('degraded');
    expect(r.redis.status).toBe('down');
  });

  it('degraded: latencia alta (> 200 ms) en Redis', async () => {
    const r = await make(ok, slow(260)).check();
    expect(r.status).toBe('degraded');
    expect(r.redis.latencyMs).toBeGreaterThan(200);
  });

  it('db caída gana sobre Redis caído: down', async () => {
    expect((await make(fail, fail).check()).status).toBe('down');
  });
});
