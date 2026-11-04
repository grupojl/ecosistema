import { InternalEventsController } from './internal-events.controller';
import { InternalEventSchema } from './schemas';

describe('InternalEventsController', () => {
  it('entrega el evento a los webhooks de la organización con su eventId (idempotencia)', async () => {
    const delivery = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const ctrl = new InternalEventsController(delivery as never);
    const out = await ctrl.publish('org-1', { eventId: 'e1', type: 'order.paid', payload: { orderId: 'o1' } });
    expect(out).toEqual({ accepted: true });
    expect(delivery.dispatch).toHaveBeenCalledWith('org-1', 'order.paid', { orderId: 'o1' }, 'e1');
  });

  it('el esquema rechaza tipos mal formados y payloads que no son objeto', () => {
    expect(InternalEventSchema.safeParse({ eventId: 'e', type: 'order.created', payload: {} }).success).toBe(true);
    expect(InternalEventSchema.safeParse({ eventId: 'e', type: 'ORDER', payload: {} }).success).toBe(false);
    expect(InternalEventSchema.safeParse({ eventId: '', type: 'order.paid', payload: {} }).success).toBe(false);
    expect(InternalEventSchema.safeParse({ eventId: 'e', type: 'order.paid', payload: 'x' }).success).toBe(false);
  });
});
