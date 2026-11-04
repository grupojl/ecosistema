/**
 * Cancelar una orden libera el stock reservado — contra POSTGRES REAL (DT-ORDER-STOCK).
 * Misma preparación que checkout.concurrency.integration.spec.ts (`pnpm test:db:setup`, `TEST_DATABASE_URL=…_test`).
 */
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCartRepository } from '@/cart/repository/prisma-cart.repository';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { OrdersService } from '@/orders/orders.service';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('cancelar orden libera stock (Postgres real)', () => {
  let prisma: PrismaService;
  let orders: OrdersService;
  const run = randomUUID().slice(0, 8);
  const org = `cancel-${run}`;
  let customerId: string;
  let variantId: string;

  const inventory = () => new PrismaInventoryRepository(prisma);
  const stock = async () => {
    const row = await inventory().findByVariant(org, variantId);
    return { available: row!.quantityAvailable, reserved: row!.quantityReserved };
  };
  const newOrder = async (quantity: number) => {
    const carts = new PrismaCartRepository(prisma);
    const cart = await carts.create(org, `s-${randomUUID()}`, customerId);
    await carts.upsertItem(org, cart.id, variantId, quantity);
    return orders.checkout({ organizationId: org, cartId: cart.id, customerId, shippingAddress: { line1: 'Calle 1' } });
  };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();
    const product = await new PrismaCatalogRepository(prisma).createProduct(org, {
      name: 'Zapato', handle: 'zapato', description: 'd',
      variants: [{ sku: `sku-${run}`, title: 'Único', priceCents: 1000, currency: 'ARS' }],
    });
    variantId = product.variants[0]!.id;
    customerId = (await new PrismaCustomersRepository(prisma).upsertByEmail(org, 'c@x.com', {})).customer.id;
    const market = { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    orders = new OrdersService(
      prisma,
      new PrismaOrdersRepository(prisma),
      new InventoryService(prisma, inventory()),
      { track: jest.fn() } as never,
      { resolveMarket: jest.fn().mockResolvedValue(market) } as never,
      { enabled: false } as never,
    );
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { organizationId: org } });
    await prisma.cart.deleteMany({ where: { organizationId: org } });
    await prisma.storeCustomer.deleteMany({ where: { organizationId: org } });
    await prisma.product.deleteMany({ where: { organizationId: org } });
    await prisma.onModuleDestroy();
  });

  it('cancelar una orden PENDING_PAYMENT devuelve lo reservado y registra el evento', async () => {
    await inventory().setAvailable(org, variantId, 10);
    const base = await stock();
    const order = await newOrder(3);
    expect(await stock()).toEqual({ available: base.available - 3, reserved: base.reserved + 3 });

    const cancelled = await orders.updateStatus(org, order.id, 'CANCELLED');

    expect(cancelled.status).toBe('CANCELLED');
    expect(await stock()).toEqual(base);
    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id, toStatus: 'CANCELLED' } });
    expect(events).toHaveLength(1);
    expect(events[0]!.fromStatus).toBe('PENDING_PAYMENT');
  });

  it('cancelar dos veces no libera dos veces (la segunda es una transición inválida)', async () => {
    const base = await stock();
    const order = await newOrder(2);
    await orders.updateStatus(org, order.id, 'CANCELLED');
    await expect(orders.updateStatus(org, order.id, 'CANCELLED')).rejects.toThrow();
    expect(await stock()).toEqual(base);
  });

  it('cancelaciones simultáneas de la misma orden liberan UNA vez', async () => {
    const base = await stock();
    const order = await newOrder(2);
    const settled = await Promise.allSettled(
      Array.from({ length: 4 }, () => orders.updateStatus(org, order.id, 'CANCELLED')),
    );
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stock()).toEqual(base);
  });

  it('si la orden ya fue pagada entre la lectura y la cancelación: Conflict y el stock sigue reservado', async () => {
    const order = await newOrder(1);
    const afterCheckout = await stock();
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } });
    // Simula que updateStatus leyó PENDING_PAYMENT antes del pago: llama directo al paso transaccional.
    const cancel = orders['settlePending'](org, order.id, 'CANCELLED');
    await expect(cancel).rejects.toBeInstanceOf(ConflictException);
    expect(await stock()).toEqual(afterCheckout);
  });

  it('pagar una orden (updateStatus PAID) convierte lo reservado en vendido: baja reserved, available no vuelve', async () => {
    await inventory().setAvailable(org, variantId, 10);
    const base = await stock();
    const order = await newOrder(3);
    await orders.updateStatus(org, order.id, 'PAID');
    expect(await stock()).toEqual({ available: base.available - 3, reserved: base.reserved });
    // y una orden pagada ya no puede cancelarse (no devolvería stock que ya se vendió)
    await expect(orders.updateStatus(org, order.id, 'CANCELLED')).rejects.toThrow();
  });

  it('vencimiento: cancela solo las PENDING_PAYMENT viejas, libera su stock y deja en paz a las recientes y a las pagadas', async () => {
    await inventory().setAvailable(org, variantId, 20);
    const base = await stock();
    const old = await newOrder(2);
    const recent = await newOrder(1);
    const paid = await newOrder(4);
    await orders.updateStatus(org, paid.id, 'PAID');
    const longAgo = new Date(Date.now() - 72 * 3_600_000);
    await prisma.order.updateMany({ where: { id: { in: [old.id, paid.id] } }, data: { createdAt: longAgo } });

    const cutoff = new Date(Date.now() - 48 * 3_600_000);
    const expired = await orders.expireUnpaid(cutoff);

    expect(expired).toBeGreaterThanOrEqual(1);
    expect((await prisma.order.findUnique({ where: { id: old.id } }))!.status).toBe('CANCELLED');
    expect((await prisma.order.findUnique({ where: { id: recent.id } }))!.status).toBe('PENDING_PAYMENT');
    expect((await prisma.order.findUnique({ where: { id: paid.id } }))!.status).toBe('PAID');
    // vieja liberada (+2 available, -2 reserved); reciente sigue reservada (1); pagada vendida (4 menos para siempre)
    expect(await stock()).toEqual({ available: base.available - 1 - 4, reserved: base.reserved + 1 });
    const ev = await prisma.orderStatusEvent.findFirst({ where: { orderId: old.id, toStatus: 'CANCELLED' } });
    expect(ev!.reason).toMatch(/Vencido/);
  });
});
