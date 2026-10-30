import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { OrganizationsClientService } from './organizations-client.service';

type Redis = { get: jest.Mock; set: jest.Mock };

function build() {
  process.env['ORGANIZATIONS_SERVICE_URL'] = 'http://sass.test/';
  process.env['INTERNAL_API_KEY'] = 'clave-de-servicio';
  const redis: Redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
  return { redis, service: new OrganizationsClientService(redis as never) };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

describe('OrganizationsClientService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('getAccess', () => {
    const allowed = { canAccess: true, role: 'OWNER' };

    it('consulta a sass-back con la credencial de servicio y la URL sin barra doble', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json(allowed));
      await service.getAccess('', 'uid 1', 'org/1');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://sass.test/internal/access/org%2F1/uid%201'); // ids escapados
      expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('clave-de-servicio');
    });

    it('cachea el acceso concedido y lo sirve sin volver a llamar', async () => {
      const { redis, service } = build();
      fetchMock.mockReturnValue(json(allowed));
      await service.getAccess('', 'uid', 'org');
      expect(redis.set).toHaveBeenCalledWith('org-access:uid:org', JSON.stringify(allowed), expect.any(Number));

      redis.get.mockResolvedValue(JSON.stringify(allowed));
      fetchMock.mockClear();
      await expect(service.getAccess('', 'uid', 'org')).resolves.toEqual(allowed);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('NO cachea un acceso denegado (un permiso recién dado debe verse enseguida)', async () => {
      const { redis, service } = build();
      fetchMock.mockReturnValue(json({ canAccess: false }));
      await service.getAccess('', 'uid', 'org');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('si Redis falla, igual responde consultando a sass-back', async () => {
      const { redis, service } = build();
      redis.get.mockRejectedValue(new Error('redis caído'));
      redis.set.mockRejectedValue(new Error('redis caído'));
      fetchMock.mockReturnValue(json(allowed));
      await expect(service.getAccess('', 'uid', 'org')).resolves.toEqual(allowed);
    });

    it('401 de sass-back = mala configuración del servicio (503), no un problema del usuario', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({}, 401));
      await expect(service.getAccess('', 'uid', 'org')).rejects.toThrow(ServiceUnavailableException);
    });

    it('otro estado no OK = 403', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({}, 404));
      await expect(service.getAccess('', 'uid', 'org')).rejects.toThrow(ForbiddenException);
    });

    it('si sass-back no responde, 503 (no se deja pasar a nadie)', async () => {
      const { service } = build();
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.getAccess('', 'uid', 'org')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('isSessionRevoked', () => {
    it('devuelve lo que informa sass-back', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({ revoked: true }));
      await expect(service.isSessionRevoked('sid-1', 'uid')).resolves.toBe(true);
    });

    it('cachea 30 s: la segunda consulta no llama', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({ revoked: false }));
      await service.isSessionRevoked('sid-2', 'uid');
      await service.isSessionRevoked('sid-2', 'uid');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('vuelve a consultar cuando el caché venció', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({ revoked: false }));
      const now = Date.now();
      const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
      await service.isSessionRevoked('sid-3', 'uid');
      spy.mockReturnValue(now + 31_000);
      await service.isSessionRevoked('sid-3', 'uid');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('fail-open: si sass-back falla o responde error, no bloquea al usuario', async () => {
      const { service } = build();
      fetchMock.mockRejectedValueOnce(new Error('caído'));
      await expect(service.isSessionRevoked('sid-4', 'uid')).resolves.toBe(false);
      fetchMock.mockReturnValueOnce(json({}, 500));
      await expect(service.isSessionRevoked('sid-5', 'uid')).resolves.toBe(false);
    });

    it('un fallo no se cachea (se reintenta en la próxima)', async () => {
      const { service } = build();
      fetchMock.mockReturnValueOnce(json({}, 500));
      await service.isSessionRevoked('sid-6', 'uid');
      fetchMock.mockReturnValueOnce(json({ revoked: true }));
      await expect(service.isSessionRevoked('sid-6', 'uid')).resolves.toBe(true);
    });
  });

  describe('resolveMarket', () => {
    const market = { id: 'm1', countryCode: 'BR', isDefault: false, fulfillmentConfig: {} };

    it('usa el caché si existe', async () => {
      const { redis, service } = build();
      redis.get.mockResolvedValue(JSON.stringify(market));
      await expect(service.resolveMarket('org', 'br')).resolves.toEqual(market);
      expect(redis.get).toHaveBeenCalledWith('market:org:BR');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resuelve en sass-back, pasa el país en mayúsculas y cachea 5 min', async () => {
      const { redis, service } = build();
      fetchMock.mockReturnValue(json({ result: { data: market } }));
      await expect(service.resolveMarket('org', 'br')).resolves.toEqual(market);

      const url = fetchMock.mock.calls[0]![0] as string;
      const input = JSON.parse(decodeURIComponent(url.split('input=')[1]!)) as { organizationId: string; countryCode: string };
      expect(input).toEqual({ organizationId: 'org', countryCode: 'BR' });
      expect(redis.set).toHaveBeenCalledWith('market:org:BR', JSON.stringify(market), 300);
    });

    it('sin país ("default"/vacío) consulta con AR como país base', async () => {
      const { service } = build();
      fetchMock.mockReturnValue(json({ result: { data: market } }));
      await service.resolveMarket('org', '');
      const url = fetchMock.mock.calls[0]![0] as string;
      expect(JSON.parse(decodeURIComponent(url.split('input=')[1]!))).toMatchObject({ countryCode: 'AR' });
    });

    it('NUNCA bloquea el checkout: ante error HTTP devuelve el Market por defecto (ADR-014)', async () => {
      const { redis, service } = build();
      fetchMock.mockReturnValue(json({}, 500));
      await expect(service.resolveMarket('org', 'BR')).resolves.toEqual({
        id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {},
      });
      expect(redis.set).not.toHaveBeenCalled(); // el fallback no se cachea
    });

    it('NUNCA bloquea el checkout: ante caída de red también devuelve el default', async () => {
      const { service } = build();
      fetchMock.mockRejectedValue(new Error('timeout'));
      await expect(service.resolveMarket('org', 'BR')).resolves.toMatchObject({ id: 'default', isDefault: true });
    });
  });
});
