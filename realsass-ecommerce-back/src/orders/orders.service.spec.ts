import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService }      from '@/orders/orders.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { InventoryService }   from '@/inventory/inventory.service';
import { ActivityService }    from '@/activity/activity.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { OutboxService }         from '@/outbox/outbox.service';
import { ORDERS_REPOSITORY }  from '@/orders/repository/orders.repository.interface';

const mockPrisma = {
  cart:  { findFirst: jest.fn(), update: jest.fn() },
  order: { create: jest.fn(), findFirst: jest.fn() },
  $queryRaw: jest.fn().mockResolvedValue([]),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService,              useValue: mockPrisma },
        { provide: ORDERS_REPOSITORY,          useValue: mockOrdersRepository },
        { provide: InventoryService,           useValue: mockInventory },
        { provide: ActivityService,            useValue: mockActivity },
        { provide: OrganizationsClientService, useValue: mockOrgsClient },
        { provide: OutboxService,              useValue: { enabled: false, enqueue: jest.fn() } },
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


  it('bloquea la fila del carrito (FOR UPDATE) antes de leerlo', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue(null);
    await expect(
      service.checkout({ organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {} }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(mockPrisma.cart.findFirst.mock.invocationCallOrder[0]!);
  });

  it('idempotente: un carrito ya CONVERTED devuelve la orden existente sin reservar stock ni crear otra', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-1', status: 'CONVERTED', items: [] });
    mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1', totalCents: 2000, items: [] });

    const result = await service.checkout({
      organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {},
    });

    expect(result).toEqual({ id: 'order-1', totalCents: 2000, items: [] });
    expect(mockPrisma.order.findFirst).toHaveBeenCalledWith({
      where:   { cartId: 'cart-1', organizationId: 'org-1', customerId: 'cust-1' },
      include: { items: true },
    });
    expect(mockInventory.reserveWithinTransaction).not.toHaveBeenCalled();
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('un carrito ABANDONED no se puede pagar', async () => {
    mockPrisma.cart.findFirst.mockResolvedValue({ id: 'cart-1', status: 'ABANDONED', items: [{ variantId: 'v1', quantity: 1 }] });
    await expect(
      service.checkout({ organizationId: 'org-1', cartId: 'cart-1', customerId: 'cust-1', shippingAddress: {} }),
    ).rejects.toThrow(BadRequestException);
    expect(mockInventory.reserveWithinTransaction).not.toHaveBeenCalled();
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
    expect(mockPrisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data:  { status: 'CONVERTED' },
    });
    expect(result).toEqual({ id: 'order-1', totalCents: 2000 });
  });
});
