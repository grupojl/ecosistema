import { createHmac } from 'node:crypto';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { assertPublicHttpUrl } from '@/common/security/assert-public-url';

jest.mock('@/common/security/assert-public-url', () => ({ assertPublicHttpUrl: jest.fn() }));

const endpoint = { id: 'w1', isActive: true, url: 'https://x.com/h', secretEncrypted: 'sealed' };
const job = (over = {}) => ({ data: { webhookId: 'w1', event: 'config.changed', payload: { a: 1 } }, attemptsMade: 0, ...over }) as never;

const make = () => {
  const prisma = {
    webhookEndpoint: { findUnique: jest.fn().mockResolvedValue(endpoint), update: jest.fn().mockResolvedValue({}) },
    webhookDeliveryLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const crypto = { open: jest.fn().mockReturnValue('whsec_abc') };
  return { proc: new WebhookDeliveryProcessor(prisma as never, crypto as never), prisma, crypto };
};

describe('WebhookDeliveryProcessor', () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (assertPublicHttpUrl as jest.Mock).mockReset().mockResolvedValue(undefined);
    global.fetch = fetchMock as never;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('entrega firmada (HMAC del cuerpo exacto), sin seguir redirects, y registra el éxito', async () => {
    const { proc, prisma } = make();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await proc.process(job());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://x.com/h');
    expect(init.redirect).toBe('error');
    expect(init.headers['X-Webhook-Signature']).toBe('sha256=' + createHmac('sha256', 'whsec_abc').update(init.body).digest('hex'));
    expect(init.headers['X-Webhook-Event']).toBe('config.changed');
    expect(prisma.webhookDeliveryLog.create.mock.calls[0]![0].data).toMatchObject({ success: true, statusCode: 200, attempt: 1 });
    expect(prisma.webhookEndpoint.update.mock.calls[0]![0].data.failureCount).toBe(0);
  });

  it('un HTTP 500 del receptor falla el job (para que BullMQ reintente) y suma una falla', async () => {
    const { proc, prisma } = make();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(proc.process(job({ attemptsMade: 1 }))).rejects.toThrow('HTTP 500');
    expect(prisma.webhookDeliveryLog.create.mock.calls[0]![0].data).toMatchObject({ success: false, statusCode: 500, attempt: 2 });
    expect(prisma.webhookEndpoint.update.mock.calls[0]![0].data.failureCount).toEqual({ increment: 1 });
  });

  it('revalida la URL en cada entrega: si ahora es interna, no hace fetch', async () => {
    const { proc } = make();
    (assertPublicHttpUrl as jest.Mock).mockRejectedValue(new Error('privada'));
    await expect(proc.process(job())).rejects.toThrow('privada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('webhook eliminado o desactivado: sale sin entregar ni registrar errores', async () => {
    const { proc, prisma } = make();
    prisma.webhookEndpoint.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...endpoint, isActive: false });
    await proc.process(job());
    await proc.process(job());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('endpoint sin clave de firma: no se firma con una clave vacía', async () => {
    const { proc, prisma } = make();
    prisma.webhookEndpoint.findUnique.mockResolvedValue({ ...endpoint, secretEncrypted: '' });
    await expect(proc.process(job())).rejects.toThrow(/sin clave de firma/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un fallo al registrar el log no tapa el resultado de la entrega', async () => {
    const { proc, prisma } = make();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    prisma.webhookDeliveryLog.create.mockRejectedValue(new Error('db'));
    prisma.webhookEndpoint.update.mockRejectedValue(new Error('db'));
    await expect(proc.process(job())).resolves.toBeUndefined();
  });

  it('idempotencia: el reintento reenvía el MISMO id y timestamp (headers y cuerpo firmado)', async () => {
    const { proc } = make();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const data = { webhookId: 'w1', event: 'e', payload: {}, eventId: 'evt-1', timestamp: '2026-01-01T00:00:00.000Z' };
    await proc.process(job({ data, attemptsMade: 0 }));
    await proc.process(job({ data, attemptsMade: 1 }));
    const [a, b] = fetchMock.mock.calls.map((c) => c[1]);
    expect(a.headers['X-Webhook-Id']).toBe('evt-1');
    expect(b.headers['X-Webhook-Id']).toBe('evt-1');
    expect(b.headers['X-Webhook-Timestamp']).toBe('2026-01-01T00:00:00.000Z');
    expect(a.body).toBe(b.body);
    expect(JSON.parse(a.body).id).toBe('evt-1');
  });

  it('jobs antiguos sin eventId: usa el id del job (estable entre reintentos)', async () => {
    const { proc } = make();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await proc.process(job({ id: 'w1:old', timestamp: 0 }));
    expect(fetchMock.mock.calls[0]![1].headers['X-Webhook-Id']).toBe('w1:old');
  });
});
