import type { OrganizationsClientService as ServiceType } from '@/organizations-client/organizations-client.service';
import type { RedisService } from '@/redis/redis.service';

const ACCESS = { canAccess: true, userId: 'u1', organizationId: 'org-1', role: 'OWNER', permissions: {} };
const res = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;

describe('OrganizationsClientService.getAccess (dashboard → sass-back)', () => {
  let Service: typeof ServiceType;
  let service: ServiceType;
  let redis: { get: jest.Mock; set: jest.Mock };
  let fetchSpy: jest.SpyInstance;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    // El circuit breaker es estado de módulo: cada test arranca con uno nuevo.
    jest.resetModules();
    ({ OrganizationsClientService: Service } = jest.requireActual<typeof import('@/organizations-client/organizations-client.service')>('@/organizations-client/organizations-client.service'));
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    service = new Service(redis as unknown as RedisService);
    for (const k of ['INTERNAL_API_KEY', 'ORGANIZATIONS_SERVICE_URL']) saved[k] = process.env[k];
    process.env['INTERNAL_API_KEY'] = 'nueva,vieja';
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  it('envía la PRIMERA clave de INTERNAL_API_KEY (rotación) y una señal de timeout', async () => {
    fetchSpy.mockResolvedValue(res(200, ACCESS));

    await expect(service.getAccess('tok', 'uid-1', 'org-1')).resolves.toMatchObject({ canAccess: true });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/internal/access/org-1/uid-1');
    expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('nueva');
    expect(init.signal).toBeDefined();
  });

  it('FALLA CERRADO sin INTERNAL_API_KEY: nunca envía una clave vacía', async () => {
    delete process.env['INTERNAL_API_KEY'];

    await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cache hit: no llama a sass-back', async () => {
    redis.get.mockResolvedValue(JSON.stringify(ACCESS));
    await expect(service.getAccess('tok', 'uid-1', 'org-1')).resolves.toMatchObject({ userId: 'u1' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('solo cachea los accesos concedidos', async () => {
    fetchSpy.mockResolvedValueOnce(res(200, { canAccess: false, reason: 'No access' }));
    await service.getAccess('tok', 'uid-1', 'org-1');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('401 (clave de servicio rechazada) => 503 de configuración; 403/404 => Forbidden', async () => {
    fetchSpy.mockResolvedValueOnce(res(401));
    await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 503 });
    fetchSpy.mockResolvedValueOnce(res(403));
    await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 403 });
    fetchSpy.mockResolvedValueOnce(res(404));
    await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 403 });
  });

  it('las respuestas 4xx NO abren el circuito (un atacante no puede dejar sin servicio al dashboard)', async () => {
    fetchSpy.mockResolvedValue(res(403));
    for (let i = 0; i < 10; i++) await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 403 });
    expect(fetchSpy).toHaveBeenCalledTimes(10);
  });

  describe('assertStorefrontOpen (¿la tienda existe y está abierta?)', () => {
    const ORG = '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b';
    const open = () => res(200, { id: ORG, status: 'ACTIVE', storeStatus: 'ACTIVE' });

    it('abierta: pasa, consulta con la clave de servicio y cachea 5 min', async () => {
      fetchSpy.mockResolvedValue(open());

      await expect(service.assertStorefrontOpen(ORG)).resolves.toBeUndefined();

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(`/internal/organizations/${ORG}`);
      expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('nueva');
      expect(redis.set).toHaveBeenCalledWith(`store-open:${ORG}`, '1', 300);
    });

    it('inexistente (404) => NotFound, cacheado 1 min como cerrada', async () => {
      fetchSpy.mockResolvedValue(res(404));

      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 404 });
      expect(redis.set).toHaveBeenCalledWith(`store-open:${ORG}`, '0', 60);
    });

    it('tienda PAUSADA => NotFound (aunque el panel esté activo)', async () => {
      fetchSpy.mockResolvedValue(res(200, { status: 'ACTIVE', storeStatus: 'PAUSED' }));
      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 404 });
    });

    it('un panel SUSPENDIDO con la tienda ACTIVA sigue abierta (son dimensiones independientes)', async () => {
      fetchSpy.mockResolvedValue(res(200, { status: 'SUSPENDED', storeStatus: 'ACTIVE' }));
      await expect(service.assertStorefrontOpen(ORG)).resolves.toBeUndefined();
    });

    it('con caché no llama a sass-back ("1" pasa, "0" corta)', async () => {
      redis.get.mockResolvedValueOnce('1');
      await expect(service.assertStorefrontOpen(ORG)).resolves.toBeUndefined();
      redis.get.mockResolvedValueOnce('0');
      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 404 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sass-back caído (5xx / red) => 503 y NO se cachea nada (falla cerrado, sin asumir "abierta")', async () => {
      fetchSpy.mockResolvedValueOnce(res(500));
      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 503 });
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 503 });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('clave de servicio rechazada (401) => 503 de configuración, no "tienda cerrada"', async () => {
      fetchSpy.mockResolvedValue(res(401));
      await expect(service.assertStorefrontOpen(ORG)).rejects.toMatchObject({ status: 503 });
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  it('red caída o 5xx => 503; tras 5 fallos el circuito corta y no vuelve a llamar', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    for (let i = 0; i < 5; i++) await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    await expect(service.getAccess('tok', 'uid-1', 'org-1')).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(5); // la 6.ª falla rápido, sin llamar
  });
});
