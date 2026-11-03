import { lookup } from 'node:dns/promises';
import { assertPublicHttpUrl, UnsafeUrlError } from './assert-public-url';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
const lookupMock = lookup as unknown as jest.Mock;

describe('assertPublicHttpUrl (anti-SSRF)', () => {
  const original = process.env['WEBHOOK_ALLOW_PRIVATE'];
  beforeEach(() => {
    delete process.env['WEBHOOK_ALLOW_PRIVATE'];
    lookupMock.mockReset();
  });
  afterAll(() => {
    if (original === undefined) delete process.env['WEBHOOK_ALLOW_PRIVATE'];
    else process.env['WEBHOOK_ALLOW_PRIVATE'] = original;
  });

  it('acepta un https que resuelve a una IP pública', async () => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    await expect(assertPublicHttpUrl('https://example.com/hook')).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['no es una URL', 'no-es-url'],
    ['protocolo no http(s)', 'ftp://example.com'],
    ['http sin permiso de privadas', 'http://example.com'],
    ['con credenciales', 'https://user:pass@example.com'],
  ])('rechaza: %s', async (_n, url) => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '198.18.0.1',
    '0.0.0.0',
    '224.0.0.1',
  ])('rechaza la IPv4 privada/reservada %s', async (ip) => {
    await expect(assertPublicHttpUrl(`https://${ip}/x`)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each(['[::1]', '[::]', '[fc00::1]', '[fd12::1]', '[fe80::1]', '[::ffff:127.0.0.1]'])(
    'rechaza la IPv6 privada %s',
    async (ip) => {
      await expect(assertPublicHttpUrl(`https://${ip}/x`)).rejects.toBeInstanceOf(UnsafeUrlError);
    },
  );

  it('acepta IPs públicas literales (v4 y v6) sin consultar DNS', async () => {
    await expect(assertPublicHttpUrl('https://8.8.8.8/x')).resolves.toBeInstanceOf(URL);
    await expect(assertPublicHttpUrl('https://[2606:4700::1111]/x')).resolves.toBeInstanceOf(URL);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rechaza un dominio que resuelve a una IP interna', async () => {
    lookupMock.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(assertPublicHttpUrl('https://evil.example.com')).rejects.toThrow(/privada/);
  });

  it('rechaza si el dominio no se resuelve o no devuelve direcciones', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicHttpUrl('https://nope.example.com')).rejects.toThrow(/resolver/);
    lookupMock.mockResolvedValue([]);
    await expect(assertPublicHttpUrl('https://vacio.example.com')).rejects.toThrow(/privada/);
  });

  it('WEBHOOK_ALLOW_PRIVATE=true permite http://localhost (desarrollo)', async () => {
    process.env['WEBHOOK_ALLOW_PRIVATE'] = 'true';
    await expect(assertPublicHttpUrl('http://localhost:4000/hook')).resolves.toBeInstanceOf(URL);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
