import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService }      from '@/orders/orders.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { InventoryService }   from '@/inventory/inventory.service';
import { ActivityService }    from '@/activity/activity.service';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import { ORDERS_REPOSITORY }  from '@/orders/repository/orders.repository.interface';

const mockPrisma = {
  cart:  { findFirst: jest.fn(), update: jest.fn() },
  order: { create: jest.fn() },
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

  it('crea la orden y marca el carrito COMPLETED en el camino feliz', async () => {
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
      data:  { status: 'COMPLETED' },
    });
    expect(result).toEqual({ id: 'order-1', totalCents: 2000 });
  });
});
