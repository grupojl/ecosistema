import { Test } from '@nestjs/testing';
import { OrdersService }      from '@/orders/orders.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { InventoryService }   from '@/inventory/inventory.service';
import { ActivityService }    from '@/activity/activity.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { OutboxService }         from '@/outbox/outbox.service';
import { ORDERS_REPOSITORY }  from '@/orders/repository/orders.repository.interface';

const cart = {
  id: 'cart-1', status: 'ACTIVE',
  items: [{ variantId: 'v1', quantity: 1, variant: { sku: 'S', priceCents: 1000, currency: 'COP' } }],
};

async function build(market: unknown) {
  const mockPrisma = {
    cart:  { findFirst: jest.fn().mockResolvedValue(cart), update: jest.fn() },
    order: { create: jest.fn().mockResolvedValue({ id: 'order-1' }), findFirst: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };
  const resolveMarket = jest.fn().mockResolvedValue(market);
  const module = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ORDERS_REPOSITORY, useValue: {} },
      { provide: InventoryService, useValue: { reserveWithinTransaction: jest.fn() } },
      { provide: ActivityService, useValue: { log: jest.fn() } },
      { provide: OrganizationsClientService, useValue: { resolveMarket } },
      { provide: OutboxService, useValue: { enabled: false, enqueue: jest.fn() } },
    ],
  }).compile();
  return { service: module.get(OrdersService), mockPrisma, resolveMarket };
}

const base = { organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {} };

describe('OrdersService.checkout — snapshot del Market (ADR-014)', () => {
  it('guarda marketId, país y una copia de la configuración de fulfillment en la orden', async () => {
    const market = { id: 'm-co', countryCode: 'CO', isDefault: false, fulfillmentConfig: { provider: 'servientrega', priority: 2 } };
    const { service, mockPrisma, resolveMarket } = await build(market);
    await service.checkout({ ...base, visitorCountryCode: 'co' });

    expect(resolveMarket).toHaveBeenCalledWith('org-1', 'CO');
    const data = mockPrisma.order.create.mock.calls[0]![0].data;
    expect(data.marketId).toBe('m-co');
    expect(data.visitorCountryCode).toBe('CO');
    expect(data.fulfillmentSnapshot).toEqual({ provider: 'servientrega', priority: 2 });
  });

  it('sin país resuelve el Market "default" y no guarda país de visitante', async () => {
    const market = { id: 'm-ar', countryCode: 'AR', isDefault: true, fulfillmentConfig: { priority: 1 } };
    const { service, mockPrisma, resolveMarket } = await build(market);
    await service.checkout(base);

    expect(resolveMarket).toHaveBeenCalledWith('org-1', 'default');
    const data = mockPrisma.order.create.mock.calls[0]![0].data;
    expect(data.visitorCountryCode).toBeNull();
    expect(data.marketId).toBe('m-ar');
  });

  it('el literal "default" tampoco se guarda como país', async () => {
    const { service, mockPrisma } = await build({ id: 'm', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} });
    await service.checkout({ ...base, visitorCountryCode: 'default' });
    expect(mockPrisma.order.create.mock.calls[0]![0].data.visitorCountryCode).toBeNull();
  });

  it('si sass-back no respondió (Market fallback "default") no se referencia un Market inexistente', async () => {
    const fallback = { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    const { service, mockPrisma } = await build(fallback);
    await service.checkout({ ...base, visitorCountryCode: 'BR' });
    const data = mockPrisma.order.create.mock.calls[0]![0].data;
    expect(data.marketId).toBeNull();
    expect(data.visitorCountryCode).toBe('BR');
  });

  it('el reintento de un checkout ya hecho no vuelve a escribir el snapshot', async () => {
    const { service, mockPrisma } = await build({ id: 'm', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} });
    mockPrisma.cart.findFirst.mockResolvedValue({ ...cart, status: 'CONVERTED' });
    mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
    await expect(service.checkout(base)).resolves.toEqual({ id: 'order-1' });
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });
});
