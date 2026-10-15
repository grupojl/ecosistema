/**
 * El servicio lee REDIS_ENABLED al cargar el módulo (constante de módulo): cada escenario lo importa en
 * un módulo aislado con el entorno ya preparado.
 */
const client = { on: jest.fn(), quit: jest.fn(), get: jest.fn(), set: jest.fn(), eval: jest.fn(), del: jest.fn() };
const RedisCtor = jest.fn(() => client);

type Svc = import('@/redis/redis.service').RedisService;

const saved = { enabled: process.env['REDIS_ENABLED'], url: process.env['REDIS_URL'] };

/** El entorno queda armado hasta el final del test (REDIS_URL se lee en onModuleInit); afterEach lo restaura. */
async function load(env: { enabled?: string; url?: string }): Promise<Svc> {
  if (env.enabled === undefined) delete process.env['REDIS_ENABLED']; else process.env['REDIS_ENABLED'] = env.enabled;
  if (env.url === undefined) delete process.env['REDIS_URL']; else process.env['REDIS_URL'] = env.url;

  let service: Svc | undefined;
  jest.isolateModules(() => {
    jest.doMock('ioredis', () => ({ __esModule: true, default: RedisCtor }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/redis/redis.service') as typeof import('@/redis/redis.service');
    service = new mod.RedisService();
  });

  if (!service) throw new Error('no se pudo cargar RedisService');
  return service;
}

describe('RedisService (ecommerce-back)', () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    for (const [k, v] of [['REDIS_ENABLED', saved.enabled], ['REDIS_URL', saved.url]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  it.each([[undefined], ['false'], ['TRUE'], ['1']])('REDIS_ENABLED=%p => no se conecta y todo es no-op', async (enabled) => {
    const service = await load({ enabled, url: 'redis://x' });

    service.onModuleInit();

    expect(RedisCtor).not.toHaveBeenCalled();
    await expect(service.get('k')).resolves.toBeNull();
    await expect(service.set('k', 'v', 10)).resolves.toBeUndefined();
    await expect(service.incrWithTtl('k', 1000)).resolves.toBeNull();
    await expect(service.del('k')).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  describe('habilitado', () => {
    it('se conecta a REDIS_URL (o a localhost por defecto) con reintentos acotados', async () => {
      const a = await load({ enabled: 'true', url: 'redis://cache:6379' });
      a.onModuleInit();
      expect(RedisCtor).toHaveBeenLastCalledWith('redis://cache:6379', expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: 3 }));

      const b = await load({ enabled: 'true' });
      b.onModuleInit();
      expect(RedisCtor).toHaveBeenLastCalledWith('redis://localhost:6379', expect.anything());
    });

    it('la estrategia de reintento crece, se topa en 10 s y se rinde tras 10 intentos', async () => {
      const service = await load({ enabled: 'true', url: 'redis://x' });
      service.onModuleInit();
      const opts = (RedisCtor.mock.calls[0] as unknown as [string, { retryStrategy: (n: number) => number | null }])[1];

      expect(opts.retryStrategy(1)).toBe(200);
      expect(opts.retryStrategy(10)).toBe(2000);
      expect(opts.retryStrategy(11)).toBeNull();
    });

    it('get / set(TTL) / del delegan en el cliente', async () => {
      const service = await load({ enabled: 'true', url: 'redis://x' });
      service.onModuleInit();
      client.get.mockResolvedValue('v');

      await expect(service.get('k')).resolves.toBe('v');
      await service.set('k', 'v', 30);
      await service.del('k');

      expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 30);
      expect(client.del).toHaveBeenCalledWith('k');
    });

    it('incrWithTtl: INCR + PEXPIRE en un solo script Lua (atómico) y devuelve un número', async () => {
      const service = await load({ enabled: 'true', url: 'redis://x' });
      service.onModuleInit();
      client.eval.mockResolvedValue('7');

      await expect(service.incrWithTtl('rl:trpc:ip', 60_000)).resolves.toBe(7);

      const [script, numKeys, key, ttl] = client.eval.mock.calls[0] as unknown as [string, number, string, string];
      expect(script).toMatch(/INCR/);
      expect(script).toMatch(/PEXPIRE/);
      expect([numKeys, key, ttl]).toEqual([1, 'rl:trpc:ip', '60000']);
    });

    it('onModuleDestroy cierra la conexión', async () => {
      const service = await load({ enabled: 'true', url: 'redis://x' });
      service.onModuleInit();

      await service.onModuleDestroy();

      expect(client.quit).toHaveBeenCalled();
    });

    it('registra los errores de conexión sin lanzar', async () => {
      const service = await load({ enabled: 'true', url: 'redis://x' });
      service.onModuleInit();
      const onError = client.on.mock.calls.find((c) => c[0] === 'error')?.[1] as (e: Error) => void;

      expect(() => onError(new Error('ECONNRESET'))).not.toThrow();
    });
  });
});
