/**
 * RedisService lee REDIS_ENABLED al IMPORTAR el módulo (constante de módulo): cada caso lo carga aislado con su entorno.
 */
const client = { on: jest.fn(), quit: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn() };
const RedisCtor = jest.fn(() => client);
jest.mock('ioredis', () => ({ __esModule: true, default: RedisCtor }));

const env = { ...process.env };
function load(enabled: boolean) {
  process.env['REDIS_ENABLED'] = enabled ? 'true' : 'false';
  let svc!: import('./redis.service').RedisService;
  jest.isolateModules(() => {
    const { RedisService } = require('./redis.service') as typeof import('./redis.service');
    svc = new RedisService();
  });
  return svc;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(client).forEach((f) => (f as jest.Mock).mockReset());
});
afterEach(() => {
  process.env = { ...env };
});

describe('RedisService (ecommerce-back)', () => {
  it('REDIS_ENABLED distinto de true: no conecta y todo es no-op', async () => {
    const svc = load(false);
    svc.onModuleInit();
    expect(RedisCtor).not.toHaveBeenCalled();
    expect(await svc.get('k')).toBeNull();
    await expect(svc.set('k', 'v', 10)).resolves.toBeUndefined();
    await expect(svc.del('k')).resolves.toBeUndefined();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('habilitado: conecta con reintentos acotados y delega get/set/del', async () => {
    process.env['REDIS_URL'] = 'redis://cache:6379';
    const svc = load(true);
    svc.onModuleInit();
    expect(RedisCtor).toHaveBeenCalledWith('redis://cache:6379', expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: 3 }));
    const { retryStrategy } = (RedisCtor.mock.calls[0] as unknown as [string, { retryStrategy: (n: number) => number | null }])[1];
    expect(retryStrategy(1)).toBe(200);
    expect(retryStrategy(11)).toBeNull(); // deja de reintentar

    client.get.mockResolvedValue('valor');
    expect(await svc.get('k')).toBe('valor');
    await svc.set('k', 'v', 30);
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 30);
    await svc.del('k');
    expect(client.del).toHaveBeenCalledWith('k');
    await svc.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });

  it('usa localhost si no hay REDIS_URL', () => {
    delete process.env['REDIS_URL'];
    load(true).onModuleInit();
    expect(RedisCtor.mock.calls[0]![0]).toBe('redis://localhost:6379');
  });

  it('registra los errores de conexión sin tumbar el servicio', () => {
    const svc = load(true);
    svc.onModuleInit();
    const onError = client.on.mock.calls.find((c) => c[0] === 'error')![1] as (e: Error) => void;
    expect(() => onError(new Error('ECONNRESET'))).not.toThrow();
  });
});
