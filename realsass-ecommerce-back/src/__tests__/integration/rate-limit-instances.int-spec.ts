/**
 * rate-limit-instances.int-spec.ts — ecommerce-back contra un Redis REAL (efímero).
 *
 * ADR-023: el rate limit de /trpc tiene que ser uno solo aunque haya varias réplicas. Con contador en memoria cada
 * instancia cuenta por su cuenta y con N réplicas el límite efectivo se multiplica por N. Acá se levantan DOS
 * aplicaciones Express independientes (cada una con su propio RedisService y su propio middleware, como dos
 * contenedores en Railway) con la política REAL de /trpc, y se comprueba que comparten el contador.
 *
 * Se saltea con aviso si no hay TEST_REDIS_URL (en el CI es obligatoria: ver test/integration-env.js).
 */
import express from 'express';
import request from 'supertest';
import { createRateLimitMiddleware, MemoryRateLimitStore, RedisRateLimitStore } from '@real/auth-server';
import { RedisService } from '@/redis/redis.service';
import { IP_RATE_LIMIT } from '@/trpc/rate-limit.config';

const enabled = Boolean(process.env['TEST_REDIS_URL']);
if (!enabled) console.warn('[rate-limit-instances.int-spec] TEST_REDIS_URL no definida: se saltean los tests.');
const suite = enabled ? describe : describe.skip;

/** Una "réplica": su propia app Express, su propio cliente Redis y el middleware con la política real. */
function replica(store: ConstructorParameters<typeof RedisRateLimitStore>[0] | 'memory') {
  const app = express();
  app.set('trust proxy', true); // la IP del cliente sale de X-Forwarded-For, igual que detrás de Railway
  const limiter = createRateLimitMiddleware({
    ...IP_RATE_LIMIT,
    store: store === 'memory' ? new MemoryRateLimitStore() : new RedisRateLimitStore(store),
  });
  app.use('/trpc', limiter, (_req, res) => { res.json({ ok: true }); });
  return app;
}

/** IP única por test: los contadores viven en Redis y no deben pisarse entre tests ni entre corridas. */
let counter = 0;
const uniqueIp = () => `10.${process.pid % 250}.${Date.now() % 250}.${(counter += 1) % 250}`;

suite('Rate limit de /trpc entre dos instancias (Redis real)', () => {
  const redisA = new RedisService();
  const redisB = new RedisService();

  beforeAll(() => {
    redisA.onModuleInit();
    redisB.onModuleInit();
  });

  afterAll(async () => {
    await redisA.onModuleDestroy();
    await redisB.onModuleDestroy();
  });

  const hit = (app: express.Express, ip: string, path = '/trpc/customer.identify') =>
    request(app).post(path).set('X-Forwarded-For', ip);

  it('customer.identify permite 10 por minuto en TOTAL entre las dos instancias, no 10 en cada una', async () => {
    const a = replica(redisA);
    const b = replica(redisB);
    const ip = uniqueIp();

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await hit(a, ip)).status);
    for (let i = 0; i < 5; i += 1) statuses.push((await hit(b, ip)).status);

    expect(statuses.every((s) => s === 200)).toBe(true); // 10 en total: todos pasan
    expect((await hit(a, ip)).status).toBe(429); // la 11ª, por cualquiera de las dos
    expect((await hit(b, ip)).status).toBe(429);
  });

  it('la respuesta 429 trae Retry-After y no filtra detalles', async () => {
    const a = replica(redisA);
    const ip = uniqueIp();
    for (let i = 0; i < 10; i += 1) await hit(a, ip);

    const res = await hit(a, ip);

    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body).toEqual({ error: { message: 'Demasiadas solicitudes', code: 'TOO_MANY_REQUESTS' } });
  });

  it('cada IP cuenta por separado: frenar a una no frena a otra', async () => {
    const a = replica(redisA);
    const b = replica(redisB);
    const atacante = uniqueIp();
    const vecino = uniqueIp();
    for (let i = 0; i < 11; i += 1) await hit(a, atacante);

    expect((await hit(b, atacante)).status).toBe(429);
    expect((await hit(b, vecino)).status).toBe(200);
  });

  it('customer.identify y customer.checkout tienen presupuestos independientes', async () => {
    const a = replica(redisA);
    const b = replica(redisB);
    const ip = uniqueIp();
    for (let i = 0; i < 10; i += 1) await hit(a, ip, '/trpc/customer.identify');

    expect((await hit(b, ip, '/trpc/customer.identify')).status).toBe(429);
    expect((await hit(b, ip, '/trpc/customer.checkout')).status).toBe(200);
  });

  it('un batch cuenta cada procedure contra su propia regla (no se evade agrupando)', async () => {
    const a = replica(redisA);
    const b = replica(redisB);
    const ip = uniqueIp();
    // 5 batches de 2 identify = 10 golpes en la regla de identify
    for (let i = 0; i < 5; i += 1) await hit(a, ip, '/trpc/customer.identify,customer.identify');

    expect((await hit(b, ip, '/trpc/customer.identify')).status).toBe(429);
  });

  it('CONTROL: con contadores en memoria las dos instancias multiplican el límite (por eso se usa Redis)', async () => {
    const a = replica('memory');
    const b = replica('memory');
    const ip = uniqueIp();

    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await hit(a, ip)).status);
    for (let i = 0; i < 10; i += 1) statuses.push((await hit(b, ip)).status);

    expect(statuses.filter((s) => s === 200)).toHaveLength(20); // 10 por instancia: el límite efectivo se duplicó
  });
});
