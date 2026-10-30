import { MarketResolverService } from './market-resolver.service';

const market = { id: 'm1', countryCode: 'AR', isDefault: true } as never;

function build() {
  const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
  return { redis, service: new MarketResolverService(redis as never) };
}

describe('MarketResolverService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('devuelve el Market cacheado sin llamar a sass-back', async () => {
    const { redis, service } = build();
    redis.get.mockResolvedValue(JSON.stringify(market));
    await expect(service.resolveMarket('org', 'ar', 'http://s', 'k')).resolves.toEqual(market);
    expect(redis.get).toHaveBeenCalledWith('market:org:AR');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('llama con la credencial de servicio, cachea 300 s y devuelve el Market', async () => {
    const { redis, service } = build();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: { data: market } }) });
    await expect(service.resolveMarket('org', 'br', 'http://s', 'k')).resolves.toEqual(market);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.startsWith('http://s/trpc/markets.resolve?input=')).toBe(true);
    expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('k');
    expect(redis.set).toHaveBeenCalledWith('market:org:BR', JSON.stringify(market), 300);
  });

  it('país vacío → clave de caché "default" y consulta con AR', async () => {
    const { redis, service } = build();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: { data: market } }) });
    await service.resolveMarket('org', '', 'http://s', 'k');
    expect(redis.get).toHaveBeenCalledWith('market:org:default');
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!))).toMatchObject({ countryCode: 'AR' });
  });

  it('lanza si sass-back responde error y no cachea nada', async () => {
    const { redis, service } = build();
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    await expect(service.resolveMarket('org', 'AR', 'http://s', 'k')).rejects.toThrow('resolveMarket failed: 502');
    expect(redis.set).not.toHaveBeenCalled();
  });
});
