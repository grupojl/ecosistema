import { RedisService } from './redis.service';

const client = {
  on: jest.fn(),
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  getdel: jest.fn(),
  keys: jest.fn(),
  status: 'ready',
};
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn(() => client) }));
import Redis from 'ioredis';

const env = { ...process.env };
const connected = async () => {
  process.env['REDIS_ENABLED'] = 'true';
  process.env['REDIS_URL'] = 'redis://localhost:6379';
  const svc = new RedisService();
  await svc.onModuleInit();
  return svc;
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(client).forEach((v) => typeof v === 'function' && (v as jest.Mock).mockReset?.());
  client.connect.mockResolvedValue(undefined);
  client.status = 'ready';
});
afterEach(() => {
  process.env = { ...env };
});

describe('RedisService: modo no-op (sin Redis)', () => {
  it.each([
    ['REDIS_ENABLED distinto de true', { REDIS_ENABLED: 'false' }],
    ['sin REDIS_URL', { REDIS_ENABLED: 'true', REDIS_URL: '' }],
  ])('%s: nada se conecta y todo devuelve valores neutros', async (_n, vars) => {
    Object.assign(process.env, vars);
    const svc = new RedisService();
    await svc.onModuleInit();
    expect(Redis).not.toHaveBeenCalled();
    expect(await svc.get('k')).toBeNull();
    expect(await svc.getDel('k')).toBeNull();
    expect(await svc.incr('k', 10)).toBe(0);
    expect(await svc.keys('*')).toEqual([]);
    expect(await svc.getJson('k')).toBeNull();
    await expect(svc.set('k', 'v')).resolves.toBeUndefined();
    await expect(svc.del('k')).resolves.toBeUndefined();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
    expect(svc.isConnected).toBe(false);
  });

  it('si la conexión falla, queda en no-op en vez de tumbar el servicio', async () => {
    client.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    const svc = await connected();
    expect(await svc.get('k')).toBeNull();
    expect(svc.isConnected).toBe(false);
  });
});

describe('RedisService: conectado', () => {
  it('conecta con reintentos acotados y registra los eventos', async () => {
    const svc = await connected();
    expect(Redis).toHaveBeenCalledWith('redis://localhost:6379', expect.objectContaining({ lazyConnect: true, maxRetriesPerRequest: 3 }));
    expect(client.on.mock.calls.map((c) => c[0]).sort()).toEqual(['connect', 'error', 'reconnecting']);
    expect(svc.isConnected).toBe(true);
    const { retryStrategy } = (Redis as unknown as jest.Mock).mock.calls[0]![1];
    expect(retryStrategy(1)).toBe(200);
    expect(retryStrategy(100)).toBeNull(); // deja de reintentar
  });

  it('set: sin TTL, con TTL numérico y con la forma EX', async () => {
    const svc = await connected();
    await svc.set('a', '1');
    await svc.set('b', '2', 30);
    await svc.set('c', '3', 'EX', 60);
    expect(client.set.mock.calls).toEqual([['a', '1'], ['b', '2', 'EX', 30], ['c', '3', 'EX', 60]]);
  });

  it('incr fija el vencimiento solo en la primera suma', async () => {
    const svc = await connected();
    client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await svc.incr('rate', 60);
    await svc.incr('rate', 60);
    expect(client.expire).toHaveBeenCalledTimes(1);
    expect(client.expire).toHaveBeenCalledWith('rate', 60);
  });

  it('del sin claves no llama a Redis; con claves, sí', async () => {
    const svc = await connected();
    await svc.del();
    expect(client.del).not.toHaveBeenCalled();
    await svc.del('a', 'b');
    expect(client.del).toHaveBeenCalledWith('a', 'b');
  });

  it('getJson / setJson: serializa, y un JSON corrupto devuelve null', async () => {
    const svc = await connected();
    await svc.setJson('k', { a: 1 }, 10);
    expect(client.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 10);
    client.get.mockResolvedValueOnce('{"a":1}').mockResolvedValueOnce('{no es json').mockResolvedValueOnce(null);
    expect(await svc.getJson('k')).toEqual({ a: 1 });
    expect(await svc.getJson('k')).toBeNull();
    expect(await svc.getJson('k')).toBeNull();
  });

  it('get / getDel / keys delegan, y al apagar cierra la conexión', async () => {
    const svc = await connected();
    client.get.mockResolvedValue('v');
    client.getdel.mockResolvedValue('x');
    client.keys.mockResolvedValue(['k1']);
    expect(await svc.get('k')).toBe('v');
    expect(await svc.getDel('k')).toBe('x');
    expect(await svc.keys('k*')).toEqual(['k1']);
    await svc.onModuleDestroy();
    expect(client.quit).toHaveBeenCalled();
  });
});
