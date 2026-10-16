import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';

function mockFetch(status: number, body: unknown): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
}

describe('OrganizationsClientService.isSessionRevoked (ADR-020 / DT-SES-05)', () => {
  let fetchSpy: jest.SpyInstance;
  const make = () => new OrganizationsClientService({} as never);

  beforeEach(() => { process.env['INTERNAL_API_KEY'] = 'k'; });
  afterEach(() => fetchSpy?.mockRestore());

  it('sesión revocada → true, consultando al sass-back con la clave interna', async () => {
    fetchSpy = mockFetch(200, { revoked: true });
    expect(await make().isSessionRevoked('sid-1', 'uid-1')).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/internal/sessions/sid-1/revoked?uid=uid-1');
    expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('k');
  });

  it('sesión vigente → false', async () => {
    fetchSpy = mockFetch(200, { revoked: false });
    expect(await make().isSessionRevoked('sid-2', 'uid-1')).toBe(false);
  });

  it('cachea 30 s: no consulta en cada request', async () => {
    fetchSpy = mockFetch(200, { revoked: true });
    const svc = make();
    await svc.isSessionRevoked('sid-3', 'uid-1');
    await svc.isSessionRevoked('sid-3', 'uid-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fail-open: si el sass-back falla o no responde, NO se corta a nadie', async () => {
    fetchSpy = mockFetch(500, {});
    expect(await make().isSessionRevoked('sid-4', 'uid-1')).toBe(false);
    fetchSpy.mockRestore();
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await make().isSessionRevoked('sid-5', 'uid-1')).toBe(false);
  });

  it('una falla transitoria no se cachea: el siguiente intento vuelve a preguntar', async () => {
    fetchSpy = mockFetch(500, {});
    const svc = make();
    await svc.isSessionRevoked('sid-6', 'uid-1');
    fetchSpy.mockRestore();
    fetchSpy = mockFetch(200, { revoked: true });
    expect(await svc.isSessionRevoked('sid-6', 'uid-1')).toBe(true);
  });
});
