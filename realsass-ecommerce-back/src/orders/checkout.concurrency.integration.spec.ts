/**
 * Checkout CONCURRENTE contra POSTGRES REAL (DT-IDEM-2, ADR-029).
 *
 * El mock de Prisma no ejercita `SELECT … FOR UPDATE` ni el `UPDATE … WHERE quantity_available >= n`: solo una base
 * real puede probar que (a) doble clic / reintento de red devuelve la MISMA orden sin reservar dos veces y (b) dos
 * compradores no pueden llevarse la última unidad. Misma preparación que los otros specs de integración
 * (`pnpm test:db:setup`, `TEST_DATABASE_URL=… pnpm test:integration`); se omite sin ella y exige que la base sea *_test.
 */
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaCartRepository } from '@/cart/repository/prisma-cart.repository';
import { PrismaCatalogRepository } from '@/catalog/repository/prisma-catalog.repository';
import { PrismaCustomersRepository } from '@/customers/repository/prisma-customers.repository';
import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { PrismaOrdersRepository } from '@/orders/repository/prisma-orders.repository';
import { InventoryService } from '@/inventory/inventory.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';
import { OrdersService } from '@/orders/orders.service';

const url = process.env['TEST_DATABASE_URL'];
const enabled = !!url && /_test(\?|$)/.test(url);
const suite = enabled ? describe : describe.skip;

suite('checkout concurrente contra Postgres real', () => {
  let prisma: PrismaService;
  let orders: OrdersService;
  const run = randomUUID().slice(0, 8);
  const org = `conc-${run}`;
  let customerId: string;
  let variantId: string;

  const inventory = () => new PrismaInventoryRepository(prisma);
  const stock = async () => {
    const row = await inventory().findByVariant(org, variantId);
    return { available: row!.quantityAvailable, reserved: row!.quantityReserved };
  };
  const cartWith = async (quantity: number) => {
    const carts = new PrismaCartRepository(prisma);
    const cart = await carts.create(org, `s-${randomUUID()}`, customerId);
    await carts.upsertItem(org, cart.id, variantId, quantity);
    return cart.id;
  };
  const checkout = (cartId: string) =>
    orders.checkout({ organizationId: org, cartId, customerId, shippingAddress: { line1: 'Calle 1' } });

  beforeAll(async () => {
    process.env['DATABASE_URL'] = url;
    prisma = new PrismaService();
    await prisma.onModuleInit();

    const product = await new PrismaCatalogRepository(prisma).createProduct(org, {
      name: 'Zapato', handle: 'zapato', description: 'd',
      variants: [{ sku: `sku-${run}`, title: 'Único', priceCents: 1000, currency: 'ARS' }],
    });
    variantId = product.variants[0]!.id;
    customerId = (await new PrismaCustomersRepository(prisma).upsertByEmail(org, 'conc@x.com', {})).customer.id;

    const inventoryService = new InventoryService(prisma, inventory());
    const market = { id: 'default', countryCode: 'AR', isDefault: true, fulfillmentConfig: {} };
    orders = new OrdersService(
      prisma,
      new PrismaOrdersRepository(prisma),
      inventoryService,
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

  it('el MISMO carrito pagado 5 veces a la vez crea UNA orden y reserva el stock UNA vez', async () => {
    await inventory().setAvailable(org, variantId, 10);
    const cartId = await cartWith(3);

    const results = await Promise.all(Array.from({ length: 5 }, () => checkout(cartId)));

    expect(new Set(results.map((o) => o.id)).size).toBe(1); // todos reciben la misma orden
    expect(await prisma.order.count({ where: { organizationId: org, cartId } })).toBe(1);
    expect(await stock()).toEqual({ available: 7, reserved: 3 }); // 3 unidades, no 15
  });

  it('un reintento posterior (carrito ya CONVERTED) devuelve la misma orden sin tocar el stock', async () => {
    const before = await stock();
    const cartId = await cartWith(1);
    const first = await checkout(cartId);
    const again = await checkout(cartId);
    expect(again.id).toBe(first.id);
    expect(await stock()).toEqual({ available: before.available - 1, reserved: before.reserved + 1 });
  });

  it('dos compradores por la ÚLTIMA unidad: uno gana, el otro recibe InsufficientStock y no hay sobreventa', async () => {
    await inventory().setAvailable(org, variantId, 1);
    const [a, b] = [await cartWith(1), await cartWith(1)];

    const settled = await Promise.allSettled([checkout(a), checkout(b)]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(InsufficientStockError);
    expect((await stock()).available).toBe(0); // nunca negativo
  });

  it('el comprador que pierde no deja reserva a medias: su orden no existe y su carrito sigue ACTIVE', async () => {
    await inventory().setAvailable(org, variantId, 2);
    const carts = await Promise.all([cartWith(2), cartWith(2), cartWith(2)]);

    const settled = await Promise.allSettled(carts.map(checkout));
    const won = settled.filter((r) => r.status === 'fulfilled').length;

    expect(won).toBe(1); // 2 unidades alcanzan para UN carrito de 2
    expect(await prisma.order.count({ where: { organizationId: org, cartId: { in: carts } } })).toBe(1);
    expect(await prisma.cart.count({ where: { id: { in: carts }, status: 'ACTIVE' } })).toBe(2);
    expect(await stock()).toEqual({ available: 0, reserved: expect.any(Number) });
  });
});
