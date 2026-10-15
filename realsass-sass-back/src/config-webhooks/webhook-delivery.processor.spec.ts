import { createHmac } from 'node:crypto';
import type { Job } from 'bullmq';
import { WebhookDeliveryProcessor } from '@/config-webhooks/webhook-delivery.processor';
import { assertPublicHttpUrl, UnsafeUrlError } from '@/common/security/assert-public-url';
import { currentTenantScope, type TenantScope } from '@/prisma/tenant-context';

jest.mock('@/common/security/assert-public-url', () => {
  class UnsafeUrlError extends Error {}
  return { assertPublicHttpUrl: jest.fn(), UnsafeUrlError };
});

const SECRET = 'whsec_secreto-del-endpoint';
const job = (data: unknown = { webhookId: 'wh-1', event: 'order.created', payload: { id: 7 } }, attemptsMade = 0) =>
  ({ data, attemptsMade }) as unknown as Job;

describe('WebhookDeliveryProcessor', () => {
  const prisma = {
    webhookEndpoint: { findUnique: jest.fn(), update: jest.fn() },
    webhookDeliveryLog: { create: jest.fn() },
  };
  const cryptoService = { open: jest.fn() };
  const processor = new WebhookDeliveryProcessor(prisma as never, cryptoService as never);
  let fetchSpy: jest.SpyInstance;

  const endpoint = (over: Record<string, unknown> = {}) => ({ id: 'wh-1', url: 'https://cliente.ejemplo.com/hook', isActive: true, secretEncrypted: 'sealed', ...over });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.webhookEndpoint.findUnique.mockResolvedValue(endpoint());
    prisma.webhookEndpoint.update.mockResolvedValue({});
    prisma.webhookDeliveryLog.create.mockResolvedValue({});
    cryptoService.open.mockReturnValue(SECRET);
    (assertPublicHttpUrl as jest.Mock).mockResolvedValue(new URL('https://cliente.ejemplo.com/hook'));
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
  });
  afterEach(() => fetchSpy.mockRestore());

  it('ADR-027: el worker lee y actualiza el endpoint como SISTEMA (el job no trae la organización)', async () => {
    const scopes: Array<TenantScope | null> = [];
    prisma.webhookEndpoint.findUnique.mockImplementation(() => { scopes.push(currentTenantScope()); return Promise.resolve(endpoint()); });
    prisma.webhookEndpoint.update.mockImplementation(() => { scopes.push(currentTenantScope()); return Promise.resolve({}); });
    prisma.webhookDeliveryLog.create.mockImplementation(() => { scopes.push(currentTenantScope()); return Promise.resolve({}); });

    await processor.process(job());

    expect(scopes).toHaveLength(3);
    expect(scopes.every((s) => s?.kind === 'system')).toBe(true);
    expect(currentTenantScope()).toBeNull();
  });

  it('envía POST con el body JSON, firma HMAC-SHA256 verificable y timestamp', async () => {
    await processor.process(job());

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://cliente.ejemplo.com/hook');
    expect(init.method).toBe('POST');

    const body = init.body as string;
    const parsed = JSON.parse(body) as { event: string; payload: unknown; timestamp: string };
    expect(parsed).toMatchObject({ event: 'order.created', payload: { id: 7 } });

    // El receptor puede verificar la firma recalculándola con el secreto compartido.
    expect(init.headers['X-Webhook-Signature']).toBe('sha256=' + createHmac('sha256', SECRET).update(body).digest('hex'));
    expect(init.headers['X-Webhook-Event']).toBe('order.created');
    // El timestamp viaja en el header Y dentro del body firmado (no se puede alterar sin invalidar la firma).
    expect(init.headers['X-Webhook-Timestamp']).toBe(parsed.timestamp);
    expect(Math.abs(Date.now() - new Date(parsed.timestamp).getTime())).toBeLessThan(5_000);
  });

  it('NO sigue redirects (un redirect podría apuntar a una dirección interna) y tiene timeout', async () => {
    await processor.process(job());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('la URL se revalida en CADA entrega (el DNS pudo cambiar desde que se creó el webhook)', async () => {
    await processor.process(job());
    expect(assertPublicHttpUrl).toHaveBeenCalledWith('https://cliente.ejemplo.com/hook');
  });

  it('si la URL ahora apunta a una dirección interna, NO se llama y se registra el fallo', async () => {
    (assertPublicHttpUrl as jest.Mock).mockRejectedValue(new UnsafeUrlError('La URL apunta a una dirección privada o interna'));

    await expect(processor.process(job())).rejects.toThrow(/privada o interna/);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ success: false, error: expect.stringContaining('privada') }) });
  });

  it('endpoint eliminado o desactivado entre el encolado y la entrega: no hace nada', async () => {
    prisma.webhookEndpoint.findUnique.mockResolvedValueOnce(null);
    await processor.process(job());
    prisma.webhookEndpoint.findUnique.mockResolvedValueOnce(endpoint({ isActive: false }));
    await processor.process(job());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('endpoint sin clave de firma: nunca firma con una clave vacía; falla y queda registrado', async () => {
    prisma.webhookEndpoint.findUnique.mockResolvedValue(endpoint({ secretEncrypted: '' }));

    await expect(processor.process(job())).rejects.toThrow(/sin clave de firma/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('respuesta 2xx: registra el éxito (con duración e intento) y reinicia el contador de fallos', async () => {
    await processor.process(job(undefined, 2));

    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ webhookId: 'wh-1', event: 'order.created', statusCode: 200, success: true, attempt: 3, error: null }),
    });
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({ where: { id: 'wh-1' }, data: expect.objectContaining({ failureCount: 0 }) });
  });

  it('respuesta no 2xx: lanza (BullMQ reintenta), registra el status y suma un fallo', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(processor.process(job())).rejects.toThrow('HTTP 500');

    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ statusCode: 500, success: false, error: 'HTTP 500' }) });
    expect(prisma.webhookEndpoint.update).toHaveBeenCalledWith({ where: { id: 'wh-1' }, data: expect.objectContaining({ failureCount: { increment: 1 } }) });
  });

  it('error de red: lanza y registra el motivo', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(processor.process(job())).rejects.toThrow('ECONNREFUSED');
    expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ statusCode: null, success: false, error: 'ECONNREFUSED' }) });
  });

  it('un fallo al escribir el log NO tapa el resultado de la entrega', async () => {
    prisma.webhookDeliveryLog.create.mockRejectedValue(new Error('db caída'));
    prisma.webhookEndpoint.update.mockRejectedValue(new Error('db caída'));
    await expect(processor.process(job())).resolves.toBeUndefined();
  });
});
