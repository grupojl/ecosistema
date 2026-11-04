import { WebhookOutboxPublisher } from './webhook-outbox.publisher';

const event = {
  id: 'ev-1', organizationId: 'org-1', aggregateType: 'Order', aggregateId: 'o1',
  type: 'order.paid', payload: { orderId: 'o1' }, attempts: 0, createdAt: new Date(),
};

describe('WebhookOutboxPublisher', () => {
  it('entrega el evento a la organización usando su id como clave de idempotencia', async () => {
    const orgs = { publishEvent: jest.fn().mockResolvedValue(undefined) };
    await new WebhookOutboxPublisher(orgs as never).publish(event);
    expect(orgs.publishEvent).toHaveBeenCalledWith('org-1', { eventId: 'ev-1', type: 'order.paid', payload: { orderId: 'o1' } });
  });

  it('si el sass-back falla, propaga el error para que el relay reintente', async () => {
    const orgs = { publishEvent: jest.fn().mockRejectedValue(new Error('HTTP 503')) };
    await expect(new WebhookOutboxPublisher(orgs as never).publish(event)).rejects.toThrow('HTTP 503');
  });
});
