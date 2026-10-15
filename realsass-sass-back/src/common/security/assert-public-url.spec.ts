import * as dns from 'node:dns/promises';
import { assertPublicHttpUrl, UnsafeUrlError } from '@/common/security/assert-public-url';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
const lookup = dns.lookup as unknown as jest.Mock;

const resolvesTo = (...addresses: string[]) => lookup.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));

describe('assertPublicHttpUrl (anti-SSRF de los webhooks salientes)', () => {
  let savedAllow: string | undefined;
  beforeEach(() => { lookup.mockReset(); savedAllow = process.env['WEBHOOK_ALLOW_PRIVATE']; delete process.env['WEBHOOK_ALLOW_PRIVATE']; });
  afterEach(() => { if (savedAllow === undefined) delete process.env['WEBHOOK_ALLOW_PRIVATE']; else process.env['WEBHOOK_ALLOW_PRIVATE'] = savedAllow; });

  describe('esquema y formato', () => {
    it.each(['no es una url', '', 'ftp://ejemplo.com/x', 'file:///etc/passwd', 'gopher://x', 'javascript:alert(1)'])('rechaza %p', async (raw) => {
      await expect(assertPublicHttpUrl(raw)).rejects.toBeInstanceOf(UnsafeUrlError);
    });

    it('exige https (http plano no)', async () => {
      resolvesTo('93.184.216.34');
      await expect(assertPublicHttpUrl('http://ejemplo.com/hook')).rejects.toThrow(/https/);
    });

    it('rechaza credenciales embebidas (https://user:pass@host)', async () => {
      resolvesTo('93.184.216.34');
      await expect(assertPublicHttpUrl('https://user:pass@ejemplo.com/hook')).rejects.toThrow(/credenciales/);
    });
  });

  describe('destinos públicos', () => {
    it('acepta un dominio que resuelve a IP pública y devuelve la URL', async () => {
      resolvesTo('93.184.216.34');
      const url = await assertPublicHttpUrl('https://ejemplo.com/hook?x=1');
      expect(url.hostname).toBe('ejemplo.com');
    });

    it('acepta una IP pública literal sin consultar DNS', async () => {
      await expect(assertPublicHttpUrl('https://93.184.216.34/hook')).resolves.toBeInstanceOf(URL);
      expect(lookup).not.toHaveBeenCalled();
    });

    it('acepta IPv6 pública', async () => {
      await expect(assertPublicHttpUrl('https://[2606:4700:4700::1111]/hook')).resolves.toBeInstanceOf(URL);
    });
  });

  describe('destinos internos (SSRF)', () => {
    it.each([
      ['loopback', '127.0.0.1'], ['loopback alto', '127.255.255.254'], ['0.0.0.0', '0.0.0.0'],
      ['RFC1918 10/8', '10.0.0.5'], ['RFC1918 172.16/12', '172.16.0.1'], ['RFC1918 172.31', '172.31.255.255'], ['RFC1918 192.168/16', '192.168.1.10'],
      ['metadata de la nube (AWS/GCP/Azure)', '169.254.169.254'], ['link-local', '169.254.1.1'],
      ['CGNAT', '100.64.0.1'], ['benchmark 198.18/15', '198.18.0.1'], ['multicast', '224.0.0.1'], ['reservado', '255.255.255.255'],
    ])('IPv4 literal: %s (%s)', async (_n, ip) => {
      await expect(assertPublicHttpUrl(`https://${ip}/hook`)).rejects.toThrow(/privada o interna/);
    });

    it.each([
      ['172.15.0.1 (justo antes de 172.16/12)', '172.15.0.1'], ['172.32.0.1 (justo después)', '172.32.0.1'], ['100.63.255.255', '100.63.255.255'],
    ])('NO bloquea de más: %s es público', async (_n, ip) => {
      await expect(assertPublicHttpUrl(`https://${ip}/hook`)).resolves.toBeInstanceOf(URL);
    });

    it.each([
      ['loopback ::1', '[::1]'], ['no especificada ::', '[::]'], ['ULA fc00::/7', '[fc00::1]'], ['ULA fd', '[fd12:3456::1]'],
      ['link-local fe80::', '[fe80::1]'],
    ])('IPv6 literal: %s', async (_n, host) => {
      await expect(assertPublicHttpUrl(`https://${host}/hook`)).rejects.toThrow(/privada o interna/);
    });

    // El parser de URL normaliza [::ffff:127.0.0.1] a [::ffff:7f00:1]: la forma hexadecimal también tiene que bloquearse.
    it.each([
      ['IPv4-mapped loopback', '[::ffff:127.0.0.1]'], ['IPv4-mapped loopback (hex)', '[::ffff:7f00:1]'],
      ['IPv4-mapped metadata de la nube', '[::ffff:169.254.169.254]'], ['IPv4-mapped metadata (hex)', '[::ffff:a9fe:a9fe]'],
      ['IPv4-mapped 10.x', '[::ffff:10.0.0.1]'], ['IPv4-mapped 192.168.x (hex)', '[::ffff:c0a8:101]'],
      ['IPv4-compatible (obsoleto) loopback', '[::7f00:1]'], ['NAT64 hacia loopback', '[64:ff9b::7f00:1]'], ['NAT64 hacia metadata', '[64:ff9b::a9fe:a9fe]'],
    ])('evasión por IPv6: %s', async (_n, host) => {
      await expect(assertPublicHttpUrl(`https://${host}/hook`)).rejects.toThrow(/privada o interna/);
    });

    it.each(['https://2130706433/hook', 'https://0x7f000001/hook', 'https://0177.0.0.1/hook', 'https://127.1/hook'])(
      'evasión por notación alternativa de IPv4 (%s): el parser la normaliza a 127.0.0.1', async (raw) => {
        await expect(assertPublicHttpUrl(raw)).rejects.toThrow(/privada o interna/);
      },
    );

    it('un dominio público que resuelve a una IP interna (DNS rebinding / registro malicioso) se bloquea', async () => {
      resolvesTo('127.0.0.1');
      await expect(assertPublicHttpUrl('https://malicioso.ejemplo.com/hook')).rejects.toThrow(/privada o interna/);
    });

    it('si CUALQUIERA de las IPs resueltas es interna, se bloquea (no alcanza con que una sea pública)', async () => {
      resolvesTo('93.184.216.34', '10.0.0.7');
      await expect(assertPublicHttpUrl('https://mixto.ejemplo.com/hook')).rejects.toThrow(/privada o interna/);
    });

    it('si el dominio no resuelve, falla cerrado', async () => {
      lookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(assertPublicHttpUrl('https://no-existe.ejemplo.com/hook')).rejects.toThrow(/No se pudo resolver/);
    });

    it('si no resuelve a ninguna dirección, falla cerrado', async () => {
      lookup.mockResolvedValue([]);
      await expect(assertPublicHttpUrl('https://vacio.ejemplo.com/hook')).rejects.toBeInstanceOf(UnsafeUrlError);
    });
  });

  describe('WEBHOOK_ALLOW_PRIVATE=true (solo desarrollo)', () => {
    it('permite http://localhost para probar un receptor local', async () => {
      process.env['WEBHOOK_ALLOW_PRIVATE'] = 'true';
      await expect(assertPublicHttpUrl('http://localhost:4000/hook')).resolves.toBeInstanceOf(URL);
    });

    it('cualquier otro valor NO relaja nada', async () => {
      for (const v of ['false', '1', 'TRUE', 'yes', '']) {
        process.env['WEBHOOK_ALLOW_PRIVATE'] = v;
        await expect(assertPublicHttpUrl('http://127.0.0.1/hook')).rejects.toBeInstanceOf(UnsafeUrlError);
      }
    });
  });
});
