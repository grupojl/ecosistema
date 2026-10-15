import Redis from 'ioredis';
import { RedisService } from '@/redis/redis.service';

const client = {
  on: jest.fn(), connect: jest.fn(), quit: jest.fn(), get: jest.fn(), set: jest.fn(), eval: jest.fn(), del: jest.fn(), keys: jest.fn(),
  status: 'ready',
};
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn(() => client) }));

const RedisCtor = Redis as unknown as jest.Mock;

describe('RedisService', () => {
  const saved = { enabled: process.env['REDIS_ENABLED'], url: process.env['REDIS_URL'] };

  /** `null` = habilitado pero SIN REDIS_URL (un `undefined` activaría el valor por defecto del parámetro). */
  const enable = (url: string | null = 'redis://localhost:6379') => {
    process.env['REDIS_ENABLED'] = 'true';
    if (url === null) delete process.env['REDIS_URL']; else process.env['REDIS_URL'] = url;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client.connect.mockResolvedValue(undefined);
    client.status = 'ready';
  });

  afterAll(() => {
    for (const [k, v] of [['REDIS_ENABLED', saved.enabled], ['REDIS_URL', saved.url]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  describe('modo no-op (sin Redis): nada rompe y nada se inventa', () => {
    it.each([
      ['REDIS_ENABLED distinto de "true"', () => { process.env['REDIS_ENABLED'] = 'false'; process.env['REDIS_URL'] = 'redis://x'; }],
      ['habilitado pero sin REDIS_URL', () => enable(null)],
    ])('%s => no se conecta y todas las operaciones son no-op', async (_label, setup) => {
      setup();
      const service = new RedisService();

      await service.onModuleInit();

      expect(RedisCtor).not.toHaveBeenCalled();
      await expect(service.get('k')).resolves.toBeNull();
      await expect(service.set('k', 'v', 10)).resolves.toBeUndefined();
      await expect(service.incrWithTtl('k', 1000)).resolves.toBeNull();   // null = "no hay contador": el rate limit lo sabe
      await expect(service.keys('*')).resolves.toEqual([]);
      await expect(service.getJson('k')).resolves.toBeNull();
      await service.del('k');
      expect(service.isConnected).toBe(false);
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });

    it('si la conexión falla al arrancar, degrada a no-op en lugar de tumbar el servicio', async () => {
      enable();
      client.connect.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = new RedisService();

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      await expect(service.get('k')).resolves.toBeNull();
      expect(service.isConnected).toBe(false);
    });
  });

  describe('con Redis', () => {
    let service: RedisService;

    beforeEach(async () => {
      enable('redis://cache:6379');
      service = new RedisService();
      await service.onModuleInit();
    });

    it('se conecta a REDIS_URL con reintentos acotados y registra los eventos', () => {
      expect(RedisCtor).toHaveBeenCalledWith('redis://cache:6379', expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: 3 }));
      expect(client.on.mock.calls.map((c) => c[0]).sort()).toEqual(['connect', 'error', 'reconnecting']);
      expect(service.isConnected).toBe(true);
    });

    it('la estrategia de reintento crece, se topa en 5 s y se rinde tras 10 intentos', () => {
      const opts = RedisCtor.mock.calls[0]?.[1] as { retryStrategy: (n: number) => number | null; reconnectOnError: (e: Error) => number | false };

      expect(opts.retryStrategy(1)).toBe(200);
      expect(opts.retryStrategy(10)).toBe(2000);
      expect(opts.retryStrategy(25)).toBeNull();
      expect(Math.max(...[1, 5, 10, 20].map((n) => opts.retryStrategy(n) ?? 0))).toBeLessThanOrEqual(5000);
      expect(opts.reconnectOnError(new Error('read ECONNRESET'))).toBe(2);
      expect(opts.reconnectOnError(new Error('otro'))).toBe(false);
    });

    it('set acepta (key, value), (key, value, ttl) y (key, value, "EX", ttl)', async () => {
      await service.set('a', '1');
      await service.set('b', '2', 30);
      await service.set('c', '3', 'EX', 60);
      await service.set('d', '4', 'EX');   // 'EX' sin ttl no inventa un vencimiento

      expect(client.set.mock.calls).toEqual([['a', '1'], ['b', '2', 'EX', 30], ['c', '3', 'EX', 60], ['d', '4']]);
    });

    it('incrWithTtl hace INCR + PEXPIRE en UN script Lua (atómico) y devuelve un número', async () => {
      client.eval.mockResolvedValue('3');

      const total = await service.incrWithTtl('rl:ip:1.2.3.4', 60_000);

      expect(total).toBe(3);
      const [script, numKeys, key, ttl] = client.eval.mock.calls[0] as [string, number, string, string];
      expect(script).toMatch(/INCR/);
      expect(script).toMatch(/PEXPIRE/);
      expect([numKeys, key, ttl]).toEqual([1, 'rl:ip:1.2.3.4', '60000']);
    });

    it('del sin claves no llama a Redis; con claves las borra todas', async () => {
      await service.del();
      expect(client.del).not.toHaveBeenCalled();

      await service.del('a', 'b');
      expect(client.del).toHaveBeenCalledWith('a', 'b');
    });

    it('getJson devuelve null ante JSON corrupto y el objeto cuando es válido', async () => {
      client.get.mockResolvedValueOnce('{no es json');
      await expect(service.getJson('k')).resolves.toBeNull();

      client.get.mockResolvedValueOnce('{"a":1}');
      await expect(service.getJson<{ a: number }>('k')).resolves.toEqual({ a: 1 });

      client.get.mockResolvedValueOnce(null);
      await expect(service.getJson('k')).resolves.toBeNull();
    });

    it('setJson serializa y respeta el TTL', async () => {
      await service.setJson('k', { a: 1 }, 120);

      expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 120);
    });

    it('keys delega y onModuleDestroy cierra la conexión', async () => {
      client.keys.mockResolvedValue(['x']);

      await expect(service.keys('x*')).resolves.toEqual(['x']);
      await service.onModuleDestroy();
      expect(client.quit).toHaveBeenCalled();
    });

    it('isConnected refleja el estado real del cliente', () => {
      client.status = 'reconnecting';

      expect(service.isConnected).toBe(false);
    });
  });
});
