import { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { RedisService } from '@/redis/redis.service';

describe('ConfigCacheService', () => {
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn(), keys: jest.fn() };
  const cache = new ConfigCacheService(redis as unknown as RedisService);

  beforeEach(() => jest.clearAllMocks());

  it('las claves incluyen la organización: dos orgs nunca comparten entrada', async () => {
    await cache.set('org-a', 'theme', 'active', { x: 1 }, 60);
    await cache.set('org-b', 'theme', 'active', { x: 2 }, 60);

    expect(redis.set.mock.calls.map((c) => c[0])).toEqual(['config:org-a:theme:active', 'config:org-b:theme:active']);
  });

  it('set serializa a JSON con TTL', async () => {
    await cache.set('org-a', 'flags', 'all', [{ k: 1 }], 120);

    expect(redis.set).toHaveBeenCalledWith('config:org-a:flags:all', '[{"k":1}]', 'EX', 120);
  });

  it('get devuelve el valor parseado, o null si no existe', async () => {
    redis.get.mockResolvedValueOnce('{"a":1}');
    await expect(cache.get('org-a', 'flags', 'all')).resolves.toEqual({ a: 1 });

    redis.get.mockResolvedValueOnce(null);
    await expect(cache.get('org-a', 'flags', 'all')).resolves.toBeNull();
  });

  it('una entrada corrupta se trata como "no está en caché" y no rompe a quien lee', async () => {
    redis.get.mockResolvedValue('{corrupto');

    await expect(cache.get('org-a', 'flags', 'all')).resolves.toBeNull();
  });

  it('del con clave borra solo esa entrada', async () => {
    await cache.del('org-a', 'flags', 'all');

    expect(redis.del).toHaveBeenCalledWith('config:org-a:flags:all');
    expect(redis.keys).not.toHaveBeenCalled();
  });

  it('del sin clave invalida SOLO el tipo de esa organización (patrón acotado)', async () => {
    redis.keys.mockResolvedValue(['config:org-a:flags:1', 'config:org-a:flags:2']);

    await cache.del('org-a', 'flags');

    expect(redis.keys).toHaveBeenCalledWith('config:org-a:flags:*');
    expect(redis.del).toHaveBeenCalledWith('config:org-a:flags:1', 'config:org-a:flags:2');
  });

  it('del sin claves coincidentes no llama a Redis a borrar', async () => {
    redis.keys.mockResolvedValue([]);

    await cache.del('org-a', 'flags');

    expect(redis.del).not.toHaveBeenCalled();
  });
});
