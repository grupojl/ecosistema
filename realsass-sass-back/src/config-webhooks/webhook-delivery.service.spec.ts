import { WebhookDeliveryService } from './webhook-delivery.service';

const make = (withQueue = true) => {
  const prisma = { webhookEndpoint: { findMany: jest.fn() }, forTenant: jest.fn() };
  prisma.forTenant.mockReturnValue(prisma);
  const queue = { add: jest.fn() };
  const svc = new WebhookDeliveryService(prisma as never, (withQueue ? queue : null) as never);
  return { svc, prisma, queue };
};

describe('WebhookDeliveryService', () => {
  afterEach(() => delete process.env['WEBHOOK_MAX_RETRIES']);

  it('sin cola (Redis deshabilitado) dispatch y dispatchTo son no-op', async () => {
    const { svc, prisma } = make(false);
    await svc.dispatch('o', 'e', {});
    await svc.dispatchTo('w', 'e', {});
    expect(prisma.webhookEndpoint.findMany).not.toHaveBeenCalled();
  });

  it('dispatch solo consulta webhooks ACTIVOS de la organización y filtra por evento (o "*")', async () => {
    const { svc, prisma, queue } = make();
    prisma.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'a', events: ['config.changed'] },
      { id: 'b', events: ['otro'] },
      { id: 'c', events: ['*'] },
    ]);
    await svc.dispatch('org-1', 'config.changed', { x: 1 });
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-1', isActive: true } });
    expect(queue.add.mock.calls.map((c) => c[1].webhookId)).toEqual(['a', 'c']);
  });

  it('el job NO lleva el secreto ni la URL y usa reintentos configurables', async () => {
    const { svc, queue } = make();
    process.env['WEBHOOK_MAX_RETRIES'] = '7';
    await svc.dispatchTo('w1', 'test', { p: 1 });
    const [name, data, opts] = queue.add.mock.calls[0]!;
    expect(name).toBe('deliver');
    expect(Object.keys(data).sort()).toEqual(['event', 'eventId', 'payload', 'timestamp', 'webhookId']);
    expect(opts.attempts).toBe(7);
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 1000 });
  });

  it('idempotencia: cada evento lleva un id propio y el jobId (webhook:id) evita encolarlo dos veces', async () => {
    const { svc, queue } = make();
    await svc.dispatchTo('w1', 'test', {});
    await svc.dispatchTo('w1', 'test', {});
    const [first, second] = queue.add.mock.calls;
    expect(first![1].eventId).not.toBe(second![1].eventId);
    expect(first![2].jobId).toBe('w1:' + first![1].eventId);
  });

  it('onConfigEvent despacha "config.changed" para la organización del payload', async () => {
    const { svc, prisma } = make();
    prisma.webhookEndpoint.findMany.mockResolvedValue([]);
    await svc.onConfigEvent({ organizationId: 'org-9' });
    expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org-9', isActive: true } });
  });

  it('signPayload es HMAC-SHA256 estable con prefijo sha256=', () => {
    const { svc } = make();
    const sig = svc.signPayload('secret', 'body');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(sig).toBe(svc.signPayload('secret', 'body'));
    expect(sig).not.toBe(svc.signPayload('otro', 'body'));
  });
});
