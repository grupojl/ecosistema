import { createHmac } from 'node:crypto';
import { WebhookDeliveryService } from '@/config-webhooks/webhook-delivery.service';
import type { IWebhooksRepository } from '@/config-webhooks/repository/webhooks.repository.interface';
import { currentTenantScope, type TenantScope } from '@/prisma/tenant-context';

// ADR-027: runInTenant exige un UUID (la organización abre el alcance de Row Level Security).
const ORG_1 = '00000000-0000-4000-8000-000000000001';

const endpoint = (id: string, events: string[]) => ({ id, events, organizationId: ORG_1, url: 'https://x', isActive: true });

describe('WebhookDeliveryService', () => {
  const repo = { findActiveByOrg: jest.fn() };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new WebhookDeliveryService(repo as unknown as IWebhooksRepository, queue as never);
  let savedRetries: string | undefined;

  beforeEach(() => { jest.clearAllMocks(); savedRetries = process.env['WEBHOOK_MAX_RETRIES']; delete process.env['WEBHOOK_MAX_RETRIES']; });
  afterEach(() => { if (savedRetries === undefined) delete process.env['WEBHOOK_MAX_RETRIES']; else process.env['WEBHOOK_MAX_RETRIES'] = savedRetries; });

  describe('dispatch', () => {
    it('ADR-027: consulta los endpoints dentro del alcance de la organización del evento (no de otra)', async () => {
      let scope: TenantScope | null = null;
      repo.findActiveByOrg.mockImplementation(() => { scope = currentTenantScope(); return Promise.resolve([]); });

      await service.dispatch(ORG_1, 'order.created', {});

      expect(scope).toEqual({ kind: 'tenant', organizationId: ORG_1 });
      expect(currentTenantScope()).toBeNull(); // el alcance no se escapa al llamador
    });

    it('encola solo para los endpoints suscriptos al evento (o a "*")', async () => {
      repo.findActiveByOrg.mockResolvedValue([endpoint('a', ['order.created']), endpoint('b', ['otro']), endpoint('c', ['*'])]);

      await service.dispatch(ORG_1, 'order.created', { id: 7 });

      const queued = queue.add.mock.calls.map(([, data]) => (data as { webhookId: string }).webhookId);
      expect(queued).toEqual(['a', 'c']);
      expect(repo.findActiveByOrg).toHaveBeenCalledWith(ORG_1); // acotado a la organización del evento
    });

    it('el job NO lleva el secreto ni la URL: el processor los lee de la base (Redis no guarda material de firma)', async () => {
      repo.findActiveByOrg.mockResolvedValue([endpoint('a', ['*'])]);

      await service.dispatch(ORG_1, 'order.created', { id: 7 });

      const [name, data] = queue.add.mock.calls[0] as [string, Record<string, unknown>];
      expect(name).toBe('deliver');
      expect(Object.keys(data).sort()).toEqual(['event', 'payload', 'webhookId']);
    });

    it('reintentos con backoff exponencial; WEBHOOK_MAX_RETRIES configurable (default 3)', async () => {
      repo.findActiveByOrg.mockResolvedValue([endpoint('a', ['*'])]);
      await service.dispatch(ORG_1, 'e', {});
      expect(queue.add.mock.calls[0]![2]).toMatchObject({ attempts: 3, backoff: { type: 'exponential', delay: 1000 } });

      process.env['WEBHOOK_MAX_RETRIES'] = '6';
      await service.dispatch(ORG_1, 'e', {});
      expect(queue.add.mock.calls[1]![2]).toMatchObject({ attempts: 6 });
    });

    it('sin cola (Redis deshabilitado) es no-op: ni siquiera consulta la base', async () => {
      const noQueue = new WebhookDeliveryService(repo as unknown as IWebhooksRepository, null);
      await expect(noQueue.dispatch(ORG_1, 'e', {})).resolves.toBeUndefined();
      await expect(noQueue.dispatchTo('wh-1', 'e', {})).resolves.toBeUndefined();
      expect(repo.findActiveByOrg).not.toHaveBeenCalled();
    });
  });

  describe('dispatchTo (botón "probar")', () => {
    it('encola para ese webhook ignorando su filtro de eventos', async () => {
      await service.dispatchTo('wh-9', 'test.ping', { ok: true });
      expect(queue.add).toHaveBeenCalledWith('deliver', { webhookId: 'wh-9', event: 'test.ping', payload: { ok: true } }, expect.anything());
    });
  });

  describe('eventos de configuración', () => {
    it('onConfigEvent reenvía como "config.changed" a la organización del evento', async () => {
      repo.findActiveByOrg.mockResolvedValue([endpoint('a', ['config.changed'])]);
      await service.onConfigEvent({ organizationId: ORG_1, key: 'tema' });
      expect(queue.add.mock.calls[0]![1]).toMatchObject({ event: 'config.changed', payload: { organizationId: ORG_1, key: 'tema' } });
    });
  });

  it('signPayload es HMAC-SHA256 en hex con prefijo sha256= (verificable por el receptor)', () => {
    expect(service.signPayload('s3cret', '{"a":1}')).toBe('sha256=' + createHmac('sha256', 's3cret').update('{"a":1}').digest('hex'));
    expect(service.signPayload('otro', '{"a":1}')).not.toBe(service.signPayload('s3cret', '{"a":1}'));
  });
});
