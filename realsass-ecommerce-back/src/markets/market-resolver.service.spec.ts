import { MarketResolverService } from '@/markets/market-resolver.service';
import type { RedisService } from '@/redis/redis.service';

const MARKET = { id: 'm1', countryCode: 'BR', isDefault: false };

describe('MarketResolverService (consumidor de resolveMarket de sass-back)', () => {
  const redis = { get: jest.fn(), set: jest.fn() };
  const service = new MarketResolverService(redis as unknown as RedisService);
  let fetchSpy: jest.SpyInstance;

  const respond = (body: unknown, ok = true, status = 200) =>
    fetchSpy.mockResolvedValue({ ok, status, json: async () => body } as Response);

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  it('con el mercado en caché no llama a sass-back', async () => {
    redis.get.mockResolvedValue(JSON.stringify(MARKET));

    await expect(service.resolveMarket('org-1', 'br', 'http://sass', 'key')).resolves.toEqual(MARKET);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('la clave de caché separa organización y país (en mayúsculas)', async () => {
    respond({ result: { data: MARKET } });

    await service.resolveMarket('org-1', 'br', 'http://sass', 'key');
    await service.resolveMarket('org-2', 'br', 'http://sass', 'key');

    expect(redis.get.mock.calls.map((c) => c[0])).toEqual(['market:org-1:BR', 'market:org-2:BR']);
  });

  it('sin caché: consulta sass-back con la clave interna, el país y un timeout, y cachea 5 minutos', async () => {
    respond({ result: { data: MARKET } });

    await expect(service.resolveMarket('org-1', 'br', 'http://sass', 'clave-interna')).resolves.toEqual(MARKET);

    const [url, init] = fetchSpy.mock.calls[0] as [string, { headers: Record<string, string>; signal: AbortSignal }];
    expect(url.startsWith('http://sass/trpc/markets.resolve?input=')).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!))).toEqual({ organizationId: 'org-1', countryCode: 'BR' });
    expect(init.headers['x-internal-api-key']).toBe('clave-interna');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(redis.set).toHaveBeenCalledWith('market:org-1:BR', JSON.stringify(MARKET), 300);
  });

  it('país vacío => cae al mercado "default" de la org (consulta AR) y cachea bajo "default"', async () => {
    respond({ result: { data: MARKET } });

    await service.resolveMarket('org-1', '', 'http://sass', 'key');

    expect(redis.get).toHaveBeenCalledWith('market:org-1:default');
    const url = (fetchSpy.mock.calls[0] as [string])[0];
    expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!)).countryCode).toBe('AR');
    expect(redis.set).toHaveBeenCalledWith('market:org-1:default', expect.any(String), 300);
  });

  it('si sass-back responde error, falla y NO cachea el fallo', async () => {
    respond({}, false, 503);

    await expect(service.resolveMarket('org-1', 'BR', 'http://sass', 'key')).rejects.toThrow('resolveMarket failed: 503');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('una entrada de caché corrupta se ignora y se vuelve a consultar (no rompe el checkout)', async () => {
    redis.get.mockResolvedValue('{corrupto');
    respond({ result: { data: MARKET } });

    await expect(service.resolveMarket('org-1', 'BR', 'http://sass', 'key')).resolves.toEqual(MARKET);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
