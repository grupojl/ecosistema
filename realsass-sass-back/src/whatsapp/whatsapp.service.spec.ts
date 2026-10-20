import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappService } from '@/whatsapp/whatsapp.service';

const jsonRes = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('WhatsappService', () => {
  const orgs = { findByIdPublic: jest.fn() };
  const fetchMock = jest.fn();
  let svc: WhatsappService;
  const realFetch = global.fetch;
  const env = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env['CHATIA_BACK_URL'] = 'http://chatia.test/';
    process.env['INTERNAL_API_KEY'] = 'k-internal';
    orgs.findByIdPublic.mockResolvedValue({ name: 'Mi Tienda', slug: 'mi-tienda' });
    svc = new WhatsappService(orgs as never);
  });

  afterAll(() => {
    global.fetch = realFetch;
    process.env = env;
  });

  it('getConnection: sin cuenta devuelve null y manda la clave interna', async () => {
    fetchMock.mockResolvedValue(jsonRes(200, { success: true, data: null }));
    await expect(svc.getConnection('org-1')).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://chatia.test/internal/whatsapp/org-1');
    expect(init.headers['x-internal-api-key']).toBe('k-internal');
  });

  it('getConnection: traduce conectado y no conectado, sin campos extra', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { data: { accountId: 'a1', displayPhoneNumber: '+54 9 11', connected: true, phone: { id: 'x' } } }),
    );
    await expect(svc.getConnection('org-1')).resolves.toEqual({
      accountId: 'a1', status: 'CONNECTED', displayPhone: '+54 9 11', errorMessage: null,
    });
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { data: { accountId: 'a1', displayPhoneNumber: null, connected: false, reason: 'Token vencido' } }),
    );
    await expect(svc.getConnection('org-1')).resolves.toMatchObject({ status: 'ERROR', errorMessage: 'Token vencido' });
  });

  it('connect: envía nombre y slug de la organización y devuelve el estado actual', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(200, { success: true }))
      .mockResolvedValueOnce(jsonRes(200, { data: { accountId: 'a1', displayPhoneNumber: '+54', connected: true } }));
    const view = await svc.connect('org-1', { code: 'c', wabaId: '12345', phoneNumberId: '67890' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ code: 'c', organizationName: 'Mi Tienda', organizationSlug: 'mi-tienda' });
    expect(view.status).toBe('CONNECTED');
  });

  it('un 4xx de chatia se reenvía con su mensaje; un 403 interno no se muestra como 403 al usuario', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(409, { message: 'Este número ya está conectado a otra organización' }));
    await expect(svc.disconnect('org-1', 'a1')).rejects.toMatchObject({ status: 409 });
    fetchMock.mockResolvedValueOnce(jsonRes(403, { message: 'API key interna inválida o ausente' }));
    const err = await svc.disconnect('org-1', 'a1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(502);
  });

  it('un 5xx o una caída de red devuelve 503 sin filtrar detalle', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(500, { message: 'stack trace secreto' }));
    const e1 = await svc.getConnection('org-1').catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((e1 as Error).message)).not.toContain('secreto');
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(svc.getConnection('org-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sin CHATIA_BACK_URL falla cerrado (503) y no llama a nadie', async () => {
    delete process.env['CHATIA_BACK_URL'];
    await expect(svc.getConnection('org-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
