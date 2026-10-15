import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService }      from '@/orders/orders.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { InventoryService }   from '@/inventory/inventory.service';
import { ActivityService }    from '@/activity/activity.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { ORDERS_REPOSITORY }  from '@/orders/repository/orders.repository.interface';

const mockPrisma = {
  cart:  { findFirst: jest.fn(), updateMany: jest.fn() },
  order: { create: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

const mockOrdersRepository = {
  findById:      jest.fn(),
  listBySession: jest.fn(),
  updateStatus:  jest.fn(),
  setPaymentIntent: jest.fn(),
};

const mockInventory = { reserveWithinTransaction: jest.fn() };
const mockActivity  = { log: jest.fn().mockResolvedValue(undefined) };
const mockOrgsClient = {
  resolveMarket: jest.fn().mockResolvedValue({
    id: 'market-default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {},
  }),
};

describe('OrdersService.checkout', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.cart.updateMany.mockResolvedValue({ count: 1 }); // por defecto el reclamo del carrito tiene éxito

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService,              useValue: mockPrisma },
        { provide: ORDERS_REPOSITORY,          useValue: mockOrdersRepository },
        { provide: InventoryService,           useValue: mockInventory },
        { provide: ActivityService,            useValue: mockActivity },
        { provide: OrganizationsClientService, useValue: mockOrgsClient },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('lanza NotFoundException si el carrito no existe', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue(null);

    await expect(
      service.checkout({
        organizationId: 'org-1',
        cartId: 'cart-x',
        customerId: 'cust-1',
        shippingAddress: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si el carrito está vacío', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-1', status: 'ACTIVE', items: [] });

    await expect(
      service.checkout({
        organizationId: 'org-1',
        cartId: 'cart-1',
        customerId: 'cust-1',
        shippingAddress: {},
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('crea la orden y marca el carrito CONVERTED en el camino feliz', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'ARS',
      sessionId: 'sess-1',
      items: [
        {
          variantId: 'v1',
          quantity: 2,
          variant: { sku: 'SKU-1', priceCents: 1000, currency: 'ARS', inventory: { quantityAvailable: 5 } },
        },
      ],
    });
    mockPrisma.order.create.mockResolvedValue({ id: 'order-1', totalCents: 2000 });

    const result = await service.checkout({
      organizationId: 'org-1',
      cartId: 'cart-1',
      customerId: 'cust-1',
      shippingAddress: { line1: 'Calle 123', city: 'Catamarca', country: 'AR' },
    });

    expect(mockInventory.reserveWithinTransaction).toHaveBeenCalledWith(
      mockPrisma, 'v1', 'SKU-1', 2,
    );
    expect(mockPrisma.cart.updateMany).toHaveBeenCalledWith({
      where: { id: 'cart-1', organizationId: 'org-1', status: 'ACTIVE' },
      data:  { status: 'CONVERTED' },
    });
    expect(result).toEqual({ id: 'order-1', totalCents: 2000 });
  });

  describe('idempotencia (reintento / doble clic)', () => {
    const input = { organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {} };

    it('si el carrito ya fue convertido devuelve la MISMA orden y no reserva stock ni crea otra', async () => {
      mockPrisma.cart.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1', items: [] });

      const result = await service.checkout(input);

      expect(result).toEqual({ id: 'order-1', items: [] });
      expect(mockInventory.reserveWithinTransaction).not.toHaveBeenCalled();
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('la orden existente se busca solo entre las del propio cliente (no se recupera la de otro)', async () => {
      mockPrisma.cart.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.checkout(input)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cartId: 'cart-1', organizationId: 'org-1', customerId: 'cust-1' } }),
      );
    });

    it('si falta stock se propaga el error (la transacción revierte también el reclamo del carrito)', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart-1', status: 'ACTIVE',
        items: [{ variantId: 'v1', quantity: 9, variant: { sku: 'SKU-1', priceCents: 1000, currency: 'ARS' } }],
      });
      mockInventory.reserveWithinTransaction.mockRejectedValueOnce(new Error('sin stock'));

      await expect(service.checkout(input)).rejects.toThrow('sin stock');
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('importes y snapshot del Market (ADR-014)', () => {
    const cart = () => ({
      id: 'cart-1', status: 'ACTIVE',
      items: [
        { variantId: 'v1', quantity: 2, variant: { sku: 'SKU-1', priceCents: 1000, currency: 'ARS' } },
        { variantId: 'v2', quantity: 1, variant: { sku: 'SKU-2', priceCents: 500, currency: 'ARS' } },
      ],
    });
    const created = () => (mockPrisma.order.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    const checkout = (extra: Record<string, unknown> = {}) =>
      service.checkout({ organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {}, ...extra });

    beforeEach(() => {
      mockPrisma.cart.findFirst.mockResolvedValue(cart());
      mockPrisma.order.create.mockResolvedValue({ id: 'order-1' });
    });

    it('el precio sale de la base (no del cliente): subtotal = Σ ítems, y subtotal + envío = total', async () => {
      mockOrgsClient.resolveMarket.mockResolvedValueOnce({
        id: 'market-ar', countryCode: 'AR', isDefault: true, fulfillmentConfig: { priority: 1, shippingCents: 300 },
      });
      await checkout();

      expect(created()).toMatchObject({ subtotalCents: 2500, shippingCents: 300, totalCents: 2800 });
    });

    it('el cliente no puede fijar el envío: un shippingCents en la entrada se ignora', async () => {
      await checkout({ shippingCents: 1 });
      expect(created()).toMatchObject({ shippingCents: 0, totalCents: 2500 });
    });

    it('sin envío: subtotal = total y envío 0', async () => {
      await checkout();
      expect(created()).toMatchObject({ subtotalCents: 2500, shippingCents: 0, totalCents: 2500 });
    });

    it('guarda el snapshot del Market con el que se vendió (id, país del visitante y fulfillment)', async () => {
      mockOrgsClient.resolveMarket.mockResolvedValueOnce({
        id: 'market-br', countryCode: 'BR', isDefault: false, fulfillmentConfig: { provider: 'correios', priority: 2 },
      });

      await checkout({ visitorCountryCode: 'br' });

      expect(mockOrgsClient.resolveMarket).toHaveBeenCalledWith('org-1', 'br');
      expect(created()).toMatchObject({
        marketId: 'market-br', visitorCountryCode: 'BR', fulfillmentSnapshot: { provider: 'correios', priority: 2 },
      });
    });

    it('si sass-back no responde (Market "default" de fallback) no se inventa un marketId', async () => {
      mockOrgsClient.resolveMarket.mockResolvedValueOnce({ id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} });

      await checkout();

      expect(created()).toMatchObject({ marketId: null, visitorCountryCode: null, fulfillmentSnapshot: {} });
      expect(mockOrgsClient.resolveMarket).toHaveBeenCalledWith('org-1', 'default');
    });

    it('el Market se resuelve ANTES de abrir la transacción (no se hace una llamada de red con la tx abierta)', async () => {
      const order: string[] = [];
      mockOrgsClient.resolveMarket.mockImplementationOnce(() => { order.push('market'); return Promise.resolve({ id: 'm', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} }); });
      mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => { order.push('tx'); return fn(mockPrisma); });

      await checkout();

      expect(order).toEqual(['market', 'tx']);
    });
  });
});
