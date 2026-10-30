import { Test } from '@nestjs/testing';
import { OrdersService }      from '@/orders/orders.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { InventoryService }   from '@/inventory/inventory.service';
import { ActivityService }    from '@/activity/activity.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { OutboxService }      from '@/outbox/outbox.service';
import { ORDERS_REPOSITORY }  from '@/orders/repository/orders.repository.interface';

const cart = {
  id: 'cart-1', status: 'ACTIVE',
  items: [{ variantId: 'v1', quantity: 2, variant: { sku: 'S', priceCents: 1000, currency: 'ARS' } }],
};
const createdOrder = {
  id: 'order-1', currency: 'ARS', marketId: 'm-ar', visitorCountryCode: 'AR',
  items: [{ variantId: 'v1' }, { variantId: 'v2' }],
};

async function build(outbox: { enabled: boolean; enqueue: jest.Mock }) {
  const order: string[] = [];
  const mockPrisma = {
    cart:  { findFirst: jest.fn().mockResolvedValue(cart), update: jest.fn(async () => { order.push('cart.update'); }) },
    order: { create: jest.fn(async () => { order.push('order.create'); return createdOrder; }), findFirst: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };
  outbox.enqueue.mockImplementation(async () => { order.push('outbox.enqueue'); });
  const module = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ORDERS_REPOSITORY, useValue: {} },
      { provide: InventoryService, useValue: { reserveWithinTransaction: jest.fn() } },
      { provide: ActivityService, useValue: { log: jest.fn() } },
      { provide: OrganizationsClientService, useValue: { resolveMarket: jest.fn().mockResolvedValue({ id: 'm-ar', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} }) } },
      { provide: OutboxService, useValue: outbox },
    ],
  }).compile();
  return { service: module.get(OrdersService), mockPrisma, order };
}

const input = { organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {} };

describe('OrdersService.checkout — Transactional Outbox (ADR-029)', () => {
  it('con el outbox activo, encola order.created con el cliente de la MISMA transacción', async () => {
    const outbox = { enabled: true, enqueue: jest.fn() };
    const { service, mockPrisma } = await build(outbox);
    await service.checkout(input);

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    const [tx, event] = outbox.enqueue.mock.calls[0]!;
    expect(tx).toBe(mockPrisma); // el tx que recibió $transaction, no el cliente global
    expect(event).toEqual({
      organizationId: 'org-1', aggregateType: 'Order', aggregateId: 'order-1', type: 'order.created',
      payload: { orderId: 'order-1', customerId: 'cust-1', totalCents: 2000, currency: 'ARS', marketId: 'm-ar', visitorCountryCode: 'AR', itemCount: 2 },
    });
  });

  it('el evento no lleva datos personales (ni dirección ni correo)', async () => {
    const outbox = { enabled: true, enqueue: jest.fn() };
    const { service } = await build(outbox);
    await service.checkout({ ...input, shippingAddress: { street: 'Calle 1', email: 'a@b.com' } });
    const json = JSON.stringify(outbox.enqueue.mock.calls[0]![1]);
    expect(json).not.toContain('Calle 1');
    expect(json).not.toContain('a@b.com');
  });

  it('se encola después de crear la orden y de convertir el carrito, dentro de la transacción', async () => {
    const outbox = { enabled: true, enqueue: jest.fn() };
    const { service, order, mockPrisma } = await build(outbox);
    await service.checkout(input);
    expect(order).toEqual(['order.create', 'cart.update', 'outbox.enqueue']);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('con el outbox apagado no escribe nada (compatible con una base sin la migración)', async () => {
    const outbox = { enabled: false, enqueue: jest.fn() };
    const { service } = await build(outbox);
    await expect(service.checkout(input)).resolves.toBeDefined();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('si no se puede encolar, el checkout falla (la transacción se revierte: nada de orden sin evento)', async () => {
    const outbox = { enabled: true, enqueue: jest.fn() };
    const { service } = await build(outbox);
    outbox.enqueue.mockRejectedValue(new Error('outbox caído'));
    await expect(service.checkout(input)).rejects.toThrow('outbox caído');
  });

  it('el reintento de un checkout ya hecho no genera un segundo evento', async () => {
    const outbox = { enabled: true, enqueue: jest.fn() };
    const { service, mockPrisma } = await build(outbox);
    mockPrisma.cart.findFirst.mockResolvedValue({ ...cart, status: 'CONVERTED' });
    mockPrisma.order.findFirst.mockResolvedValue(createdOrder);
    await service.checkout(input);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
